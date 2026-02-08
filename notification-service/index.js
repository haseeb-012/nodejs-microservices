import amqp from 'amqplib';
import express from 'express';

console.log('🚀 Starting Notification Service (RabbitMQ Consumer)...');

const app = express();
const PORT = 3003; // Different port than task service

// RabbitMQ connection configuration (WITH CREDENTIALS)
const RABBITMQ_URL = 'amqp://rabbitmq:5672';
const QUEUE_NAME = 'task_created';

let notifications = [];
let channel = null;
let connection = null;

// Connect and consume messages
const startConsumer = async () => {
	try {
		// 1. Connect to RabbitMQ WITH CREDENTIALS
		console.log(`🔄 Connecting to RabbitMQ...`);
		connection = await amqp.connect(RABBITMQ_URL);
		channel = await connection.createChannel();

		// 2. Ensure queue exists
		await channel.assertQueue(QUEUE_NAME, { durable: true });
		console.log(
			`✅ Connected to RabbitMQ, waiting for messages on queue: "${QUEUE_NAME}"`,
		);

		// 3. Set prefetch
		channel.prefetch(1);

		// 4. Start consuming messages
		channel.consume(
			QUEUE_NAME,
			async (message) => {
				if (message !== null) {
					try {
						// Parse the message
						const taskData = JSON.parse(message.content.toString());
						console.log('\n📥 ===== RECEIVED MESSAGE =====');
						console.log('Task Data:', JSON.stringify(taskData, null, 2));

						// Process the notification
						await processNotification(taskData);

						// Acknowledge the message
						channel.ack(message);
						console.log('✅ Message acknowledged and processed\n');
					} catch (error) {
						console.error('❌ Error processing message:', error);
						channel.nack(message, false, false);
					}
				}
			},
			{ noAck: false },
		);

		// Handle connection errors
		connection.on('error', (err) => {
			console.error('❌ RabbitMQ connection error:', err.message);
		});

		connection.on('close', () => {
			console.log('⚠️ RabbitMQ connection closed, reconnecting...');
			setTimeout(startConsumer, 5000);
		});

		console.log('🎯 Consumer is ready and waiting for messages...\n');
	} catch (error) {
		console.error('❌ Failed to connect to RabbitMQ:', error.message);
		console.log('🔄 Retrying in 5 seconds...');
		setTimeout(startConsumer, 5000);
	}
};

// Process notification
const processNotification = async (taskData) => {
	const notification = {
		id: Date.now(),
		timestamp: new Date().toISOString(),
		type: 'TASK_CREATED',
		data: taskData,
		processedAt: new Date().toISOString(),
	};

	notifications.push(notification);

	// Display notification
	console.log('\n🔔 ===== NOTIFICATION =====');
	console.log(`📋 Title: New Task Created`);
	console.log(`📝 Message: "${taskData.title}" has been created`);
	console.log(`👤 User: ${taskData.userId || 'Unknown'}`);
	console.log(`🆔 Task ID: ${taskData.taskId || taskData._id}`);
	console.log(`📅 Created: ${new Date(taskData.createdAt).toLocaleString()}`);
	console.log(`⏰ Processed: ${new Date().toLocaleTimeString()}`);
	console.log(`===========================\n`);

	// Keep only last 100
	if (notifications.length > 100) {
		notifications = notifications.slice(-100);
	}
};

// Health endpoint
app.get('/health', (req, res) => {
	res.json({
		service: 'Notification Consumer',
		status: 'running',
		queue: QUEUE_NAME,
		messagesProcessed: notifications.length,
		rabbitmq: channel ? 'connected' : 'disconnected',
		timestamp: new Date().toISOString(),
	});
});

app.get('/stats', (req, res) => {
	res.json({
		totalProcessed: notifications.length,
		lastNotifications: notifications.slice(-5),
		uptime: process.uptime(),
	});
});

// Start everything
const start = async () => {
	// Start health server
	app.listen(PORT, '0.0.0.0', () => {
		console.log(`📊 Health check: http://localhost:${PORT}/health`);
	});

	// Start RabbitMQ consumer
	await startConsumer();
};

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('🛑 Shutting down...');
	if (channel) channel.close();
	if (connection) connection.close();
	process.exit(0);
});

// Start
start().catch(console.error);
