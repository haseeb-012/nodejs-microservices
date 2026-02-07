import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

const app = express();
const port = process.env.PORT || 3001; // Different port than user service

app.use(bodyParser.json());

// MongoDB connection
const connectDB = async () => {
	try {
		const mongoURI = process.env.MONGO_URI || 'mongodb://mongodb:27017/tasks';

		await mongoose.connect(mongoURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			serverSelectionTimeoutMS: 5000,
		});

		console.log('✅ Task Service: MongoDB connected successfully!');
	} catch (err) {
		console.error('❌ Task Service: MongoDB connection error:', err.message);
		console.log('🔄 Retrying in 3 seconds...');
		setTimeout(connectDB, 3000);
	}
};

connectDB();

// Task Schema
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
			ref: 'User', // Reference to User model if you have one
		},
	},
	{
		timestamps: true,
	},
);

const Task = mongoose.model('Task', taskSchema);

// Routes

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

		const task = await Task.create({
			title,
			description: description || '',
			status: status || 'pending',
			priority: priority || 'medium',
			dueDate: dueDate || null,
			userId: userId || null,
		});

		res.status(201).json({
			success: true,
			message: 'Task created successfully',
			data: task,
		});
	} catch (err) {
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
			new: true, // Return updated document
			runValidators: true, // Validate update
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

// Health check endpoint
app.get('/health', (req, res) => {
	const dbState = mongoose.connection.readyState;
	const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

	res.json({
		service: 'Task Service',
		status: 'OK',
		timestamp: new Date(),
		database: dbStatus,
		databaseState: dbState,
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

// Start server
app.listen(port, () => {
	console.log(`🚀 Task Service running on port ${port}`);
});
