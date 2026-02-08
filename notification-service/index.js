import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

const app = express();
const port = process.env.PORT || 3003; // Different port than task/user service

app.use(bodyParser.json());

// MongoDB connection
const connectDB = async () => {
	try {
		const mongoURI = process.env.MONGO_URI || 'mongodb://mongodb:27017/notifications';

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





// Start server
app.listen(port, () => {
	console.log(`🚀 Task Service running on port ${port}`);
});
