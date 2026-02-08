import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import amqp from 'amqplib';

const app = express();
const port = process.env.PORT || 3002; // Use 3002 to match Docker mapping

app.use(bodyParser.json());

// ========== MONGODB CONNECTION ==========
const connectDB = async () => {
	try {
		const mongoURI = process.env.MONGO_URI || 'mongodb://mongodb:27017/tasks';
		await mongoose.connect(mongoURI);
		console.log('✅ MongoDB connected successfully!');
	} catch (err) {
		console.error('❌ MongoDB connection error:', err.message);
		console.log('🔄 Retrying in 3 seconds...');
		setTimeout(connectDB, 3000);
	}
};

connectDB();

// ========== RABBITMQ CONNECTION ==========
let channel = null;
let connection = null;

const connectRabbitMQ = async (retries = 5, delay = 5000) => {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			console.log(`🔄 RabbitMQ connection attempt ${attempt}/${retries}...`);

			// Connect with credentials
			const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
			connection = await amqp.connect(rabbitmqUrl);
			channel = await connection.createChannel();

			// Create queue
			await channel.assertQueue('task_created', {
				durable: true,
			});

			console.log('✅ RabbitMQ connected successfully!');
			console.log('📬 Queue "task_created" is ready');

			// Set up error handling
			connection.on('error', (err) => {
				console.error('❌ RabbitMQ connection error:', err.message);
				channel = null;
			});

			connection.on('close', () => {
				console.log('⚠️ RabbitMQ connection closed');
				channel = null;
				setTimeout(connectRabbitMQ, 5000);
			});

			return;
		} catch (error) {
			console.error(
				`❌ RabbitMQ connection failed (attempt ${attempt}):`,
				error.message,
			);

			if (attempt < retries) {
				console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				console.error('💥 Failed to connect to RabbitMQ after all retries');
				console.log('ℹ️ Service will run without RabbitMQ');
			}
		}
	}
};

// ========== TASK SCHEMA & MODEL ==========
const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: '',
		},
		status: {
			type: String,
			enum: ['pending', 'in-progress', 'completed'],
			default: 'pending',
		},
		priority: {
			type: String,
			enum: ['low', 'medium', 'high'],
			default: 'medium',
		},
		dueDate: {
			type: Date,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{
		timestamps: true,
	},
);

const Task = mongoose.model('Task', taskSchema);

// ========== ROUTES ==========

// 1. GET all tasks
app.get('/tasks', async (req, res) => {
	try {
		const tasks = await Task.find();
		res.json({
			success: true,
			count: tasks.length,
			data: tasks,
		});
	} catch (err) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch tasks',
			error: err.message,
		});
	}
});

// 2. GET single task by ID
app.get('/tasks/:id', async (req, res) => {
	try {
		const task = await Task.findById(req.params.id);
		if (!task) {
			return res.status(404).json({
				success: false,
				message: 'Task not found',
			});
		}
		res.json({
			success: true,
			data: task,
		});
	} catch (err) {
		res.status(500).json({
			success: false,
			message: 'Failed to fetch task',
			error: err.message,
		});
	}
});

// 3. POST create new task
app.post('/tasks', async (req, res) => {
	try {
		const { title, description, status, priority, dueDate, userId } = req.body;

		// Validation
		if (!title) {
			return res.status(400).json({
				success: false,
				message: 'Title is required',
			});
		}

		// Create task in database
		const task = await Task.create({
			title,
			description: description || '',
			status: status || 'pending',
			priority: priority || 'medium',
			dueDate: dueDate || null,
			userId: userId || null,
		});

		// Send message to RabbitMQ if connected
		if (channel) {
			const message = {
				event: 'task.created',
				taskId: task._id.toString(),
				title: task.title,
				description: task.description,
				status: task.status,
				userId: task.userId,
				createdAt: task.createdAt,
				timestamp: new Date(),
			};

			channel.sendToQueue(
				'task_created',
				Buffer.from(JSON.stringify(message)),
				{ persistent: true },
			);

			console.log('📤 Message sent to RabbitMQ:', message);
		} else {
			console.warn('⚠️ RabbitMQ not available, task saved without messaging');
		}

		res.status(201).json({
			success: true,
			message: 'Task created successfully',
			data: task,
		});
	} catch (err) {
		console.error('Error creating task:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to create task',
			error: err.message,
		});
	}
});

// 4. PUT update task
app.put('/tasks/:id', async (req, res) => {
	try {
		const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});

		if (!task) {
			return res.status(404).json({
				success: false,
				message: 'Task not found',
			});
		}

		res.json({
			success: true,
			message: 'Task updated successfully',
			data: task,
		});
	} catch (err) {
		res.status(500).json({
			success: false,
			message: 'Failed to update task',
			error: err.message,
		});
	}
});

// 5. DELETE task
app.delete('/tasks/:id', async (req, res) => {
	try {
		const task = await Task.findByIdAndDelete(req.params.id);

		if (!task) {
			return res.status(404).json({
				success: false,
				message: 'Task not found',
			});
		}

		res.json({
			success: true,
			message: 'Task deleted successfully',
		});
	} catch (err) {
		res.status(500).json({
			success: false,
			message: 'Failed to delete task',
			error: err.message,
		});
	}
});

// ========== HEALTH & INFO ENDPOINTS ==========

// Health check
app.get('/health', (req, res) => {
	const dbState = mongoose.connection.readyState;
	const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
	const rabbitmqStatus = channel ? 'connected' : 'disconnected';

	res.json({
		service: 'Task Service',
		status: 'OK',
		timestamp: new Date(),
		port: port,
		database: dbStatus,
		rabbitmq: rabbitmqStatus,
	});
});

// Root endpoint
app.get('/', (req, res) => {
	res.json({
		service: 'Task Service API',
		version: '1.0.0',
		endpoints: {
			getAllTasks: 'GET /tasks',
			getTask: 'GET /tasks/:id',
			createTask: 'POST /tasks',
			updateTask: 'PUT /tasks/:id',
			deleteTask: 'DELETE /tasks/:id',
			health: 'GET /health',
		},
	});
});

// ========== START SERVER ==========
app.listen(port, '0.0.0.0', async () => {
	console.log(`🚀 Task Service running on http://0.0.0.0:${port}`);

	// Connect to RabbitMQ
	await connectRabbitMQ();
});
