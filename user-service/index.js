import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

const app = express();
const port = 3000;

app.use(bodyParser.json());

mongoose
	.connect('mongodb://mongodb:27017/users')
	.then(() => {
		console.log('DB is connected to MongoDB');
	})
	.catch((err) => {
		console.error('Error in db', err);
	});

const userSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: true,
	},
);
const User = mongoose.model('User', userSchema);

// 1. GET all users
app.get('/users', async (req, res) => {
	try {
		const users = await User.find();
		res.json(users);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// 2. GET single user by ID
app.get('/users/:id', async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) return res.status(404).json({ error: 'User not found' });
		res.json(user);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});
//  Create a new user
app.post('/users', async (req, res) => {
	try {
		const { username, email } = req.body;

		// basic validation
		if (!username || !email) {
			return res.status(400).json({
				message: 'username and email are required',
			});
		}

		const user = await User.create({
			username,
			email,
		});

		res.status(201).json({
			message: 'User created successfully',
			user,
		});
	} catch (error) {
		res.status(500).json({
			message: 'Failed to create user',
			error: error.message,
		});
	}
});

// 4. UPDATE user by ID
app.put('/users/:id', async (req, res) => {
	try {
		const user = await User.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ new: true, runValidators: true }, // Returns updated document
		);
		if (!user) return res.status(404).json({ error: 'User not found' });
		res.json(user);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

// 5. DELETE user by ID
app.delete('/users/:id', async (req, res) => {
	try {
		const user = await User.findByIdAndDelete(req.params.id);
		if (!user) return res.status(404).json({ error: 'User not found' });
		res.json({ message: 'User deleted successfully' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/', (req, res) => {
	res.send('Hello World');
});

app.listen(port, () => {
	console.log(`server listn on port ${port}`);
});
