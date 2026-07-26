const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000'], 
    // , 'http://127.0.0.1:3000'
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token']
}));
app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("playzone");
        console.log("Connected successfully to MongoDB database: playzone");
    } catch (err) {
        console.error("MongoDB connection error:", err);
    }
}

connectDB();

// Helper middleware: Authenticate requests using better-auth session token or Bearer JWT token
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const sessionHeader = req.headers['x-session-token'];
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (sessionHeader) {
            token = sessionHeader;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
        }

        // Look up session in MongoDB 'session' collection created by better-auth
        const sessionCollection = db.collection("session");
        const userCollection = db.collection("user");

        const session = await sessionCollection.findOne({ token });

        if (!session) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
        }

        if (new Date(session.expiresAt) < new Date()) {
            return res.status(401).json({ success: false, message: 'Session token has expired.' });
        }

        // Fetch user from 'user' collection
        let user;
        try {
            user = await userCollection.findOne({ _id: new ObjectId(session.userId) });
        } catch {
            user = await userCollection.findOne({ id: session.userId });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Associated user account not found.' });
        }

        req.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role || 'user',
            phone: user.phone || ''
        };
        req.session = session;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ success: false, message: 'Authentication error' });
    }
};

// Helper middleware: Require specific user roles
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}.`
            });
        }
        next();
    };
};

// --- Routes ---

app.get('/', (req, res) => {
    res.json({
        name: 'PlayZone API Server',
        status: 'running',
        version: '1.0.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        dbConnected: Boolean(db),
        timestamp: new Date().toISOString()
    });
});

// Authenticated user profile verification endpoint
app.get('/api/auth/me', authenticateUser, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Export middlewares and app for sub-modules if needed
app.listen(PORT, () => {
    console.log(`PlayZone server running on port ${PORT}`);
});
