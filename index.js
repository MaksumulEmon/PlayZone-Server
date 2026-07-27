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
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
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
        await seedInitialPlaygrounds();
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

        const sessionCollection = db.collection("session");
        const userCollection = db.collection("user");

        const session = await sessionCollection.findOne({ token });

        if (!session) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
        }

        if (new Date(session.expiresAt) < new Date()) {
            return res.status(401).json({ success: false, message: 'Session token has expired.' });
        }

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

// Seed sample grounds if collection is empty
async function seedInitialPlaygrounds() {
    try {
        const playgrounds = db.collection("playgrounds");
        const count = await playgrounds.countDocuments();
        if (count === 0) {
            const initialGrounds = [
                {
                    title: "Apex Arena Futsal Turf",
                    description: "Premium artificial turf ground for 5-a-side and 7-a-side football matches. Equipped with high-power LED night floodlights and locker rooms.",
                    sportType: "Football",
                    city: "North City",
                    address: "102 Stadium Boulevard, North City",
                    image: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&auto=format&fit=crop&q=60",
                    pricePerHour: 45,
                    openTime: "07:00",
                    closeTime: "23:00",
                    amenities: ["Lighting", "Changing Room", "Parking", "Shower", "Refreshments"],
                    ownerId: "demo-owner",
                    ownerEmail: "owner@playzone.com",
                    ownerName: "Marcus Vance",
                    status: "active",
                    createdAt: new Date()
                },
                {
                    title: "SmashZone Indoor Badminton Club",
                    description: "Professional synthetic wooden mat courts with BWF standard spacing and climate control.",
                    sportType: "Badminton",
                    city: "Central District",
                    address: "45 Sports Complex Avenue, Central District",
                    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=60",
                    pricePerHour: 30,
                    openTime: "06:00",
                    closeTime: "22:00",
                    amenities: ["Lighting", "Changing Room", "Equipment Rental", "Shower"],
                    ownerId: "demo-owner",
                    ownerEmail: "owner@playzone.com",
                    ownerName: "Marcus Vance",
                    status: "active",
                    createdAt: new Date()
                },
                {
                    title: "Grand Slam Tennis Complex",
                    description: "Standard hard tennis court with court lighting and spectator seating.",
                    sportType: "Tennis",
                    city: "Westside",
                    address: "88 Grand Slam Drive, Westside",
                    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=60",
                    pricePerHour: 55,
                    openTime: "08:00",
                    closeTime: "21:00",
                    amenities: ["Lighting", "Parking", "Refreshments"],
                    ownerId: "demo-owner",
                    ownerEmail: "owner@playzone.com",
                    ownerName: "Marcus Vance",
                    status: "active",
                    createdAt: new Date()
                },
                {
                    title: "Strikers Cricket Turf Arena",
                    description: "Box cricket and net practice turf with bowling machines and digital scoreboard.",
                    sportType: "Cricket",
                    city: "Eastside",
                    address: "12 Cricket Ground Way, Eastside",
                    image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=60",
                    pricePerHour: 60,
                    openTime: "06:00",
                    closeTime: "23:00",
                    amenities: ["Lighting", "Equipment Rental", "Parking", "Refreshments"],
                    ownerId: "demo-owner",
                    ownerEmail: "owner@playzone.com",
                    ownerName: "Marcus Vance",
                    status: "active",
                    createdAt: new Date()
                }
            ];
            await playgrounds.insertMany(initialGrounds);
            console.log("Seeded initial sample playgrounds to MongoDB.");
        }
    } catch (e) {
        console.error("Error seeding initial playgrounds:", e);
    }
}

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

// --- PLAYGROUNDS ENDPOINTS ---

// GET All Playgrounds (Public - supports filters by sportType, city, search)
// app.get('/api/playgrounds', async (req, res) => {
//     try {
//         const { sportType, city, search } = req.query;
//         const query = { status: "active" };

//         if (sportType && sportType !== "All") {
//             query.sportType = { $regex: new RegExp(`^${sportType}$`, "i") };
//         }
//         if (city) {
//             query.city = { $regex: new RegExp(city, "i") };
//         }
//         if (search) {
//             query.$or = [
//                 { title: { $regex: new RegExp(search, "i") } },
//                 { description: { $regex: new RegExp(search, "i") } },
//                 { city: { $regex: new RegExp(search, "i") } },
//                 { sportType: { $regex: new RegExp(search, "i") } }
//             ];
//         }

//         const playgrounds = await db.collection("playgrounds").find(query).sort({ createdAt: -1 }).toArray();
//         res.json({ success: true, count: playgrounds.length, data: playgrounds });
//     } catch (error) {
//         console.error("Error fetching playgrounds:", error);
//         res.status(500).json({ success: false, message: "Error fetching playgrounds" });
//     }
// });

// GET My Playgrounds (Authenticated Owner / Admin)
app.get('/api/playgrounds/my-grounds', authenticateUser, async (req, res) => {
    try {
        const query = req.user.role === 'admin' 
            ? {} 
            : { $or: [{ ownerId: req.user.id }, { ownerEmail: req.user.email }] };

        const myGrounds = await db.collection("playgrounds").find(query).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, count: myGrounds.length, data: myGrounds });
    } catch (error) {
        console.error("Error fetching owner playgrounds:", error);
        res.status(500).json({ success: false, message: "Error fetching your playgrounds" });
    }
});

// GET Single Playground by ID
app.get('/api/playgrounds/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let ground;
        try {
            ground = await db.collection("playgrounds").findOne({ _id: new ObjectId(id) });
        } catch {
            ground = await db.collection("playgrounds").findOne({ id: id });
        }

        if (!ground) {
            return res.status(404).json({ success: false, message: "Playground not found" });
        }

        res.json({ success: true, data: ground });
    } catch (error) {
        console.error("Error fetching playground:", error);
        res.status(500).json({ success: false, message: "Error fetching playground details" });
    }
});

// POST Create New Playground (Authenticated Owner or Admin)
app.post('/api/playgrounds', authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'owner' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Access denied. Only ground owners or admins can list grounds." });
        }

        const { title, description, sportType, city, address, image, pricePerHour, openTime, closeTime, amenities } = req.body;

        if (!title || !sportType || !city || !pricePerHour || !openTime || !closeTime) {
            return res.status(400).json({ success: false, message: "Title, sport type, city, price per hour, opening & closing times are required." });
        }

        const newGround = {
            title: title.trim(),
            description: (description || "").trim(),
            sportType: sportType.trim(),
            city: city.trim(),
            address: (address || "").trim(),
            image: (image || "").trim() || "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&auto=format&fit=crop&q=60",
            pricePerHour: Number(pricePerHour),
            openTime: openTime,
            closeTime: closeTime,
            amenities: Array.isArray(amenities) ? amenities : [],
            ownerId: req.user.id,
            ownerEmail: req.user.email,
            ownerName: req.user.name,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection("playgrounds").insertOne(newGround);
        res.status(201).json({
            success: true,
            message: "Playground listed successfully!",
            data: { ...newGround, _id: result.insertedId }
        });
    } catch (error) {
        console.error("Error creating playground:", error);
        res.status(500).json({ success: false, message: "Server error creating playground" });
    }
});

// PUT Update Playground (Owner of listing or Admin)
app.put('/api/playgrounds/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        let ground;
        try {
            ground = await db.collection("playgrounds").findOne({ _id: new ObjectId(id) });
        } catch {
            ground = await db.collection("playgrounds").findOne({ id: id });
        }

        if (!ground) {
            return res.status(404).json({ success: false, message: "Playground not found" });
        }

        // Ownership Check
        if (req.user.role !== 'admin' && ground.ownerId !== req.user.id && ground.ownerEmail !== req.user.email) {
            return res.status(403).json({ success: false, message: "Forbidden. You can only update your own playgrounds." });
        }

        const { title, description, sportType, city, address, image, pricePerHour, openTime, closeTime, amenities, status } = req.body;

        const updateFields = {
            updatedAt: new Date()
        };
        if (title) updateFields.title = title.trim();
        if (description !== undefined) updateFields.description = description.trim();
        if (sportType) updateFields.sportType = sportType.trim();
        if (city) updateFields.city = city.trim();
        if (address !== undefined) updateFields.address = address.trim();
        if (image !== undefined) updateFields.image = image.trim();
        if (pricePerHour !== undefined) updateFields.pricePerHour = Number(pricePerHour);
        if (openTime) updateFields.openTime = openTime;
        if (closeTime) updateFields.closeTime = closeTime;
        if (amenities !== undefined) updateFields.amenities = Array.isArray(amenities) ? amenities : [];
        if (status) updateFields.status = status;

        await db.collection("playgrounds").updateOne(
            { _id: ground._id },
            { $set: updateFields }
        );

        const updatedGround = await db.collection("playgrounds").findOne({ _id: ground._id });
        res.json({ success: true, message: "Playground updated successfully!", data: updatedGround });
    } catch (error) {
        console.error("Error updating playground:", error);
        res.status(500).json({ success: false, message: "Server error updating playground" });
    }
});

// DELETE Playground (Owner of listing or Admin)
app.delete('/api/playgrounds/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        let ground;
        try {
            ground = await db.collection("playgrounds").findOne({ _id: new ObjectId(id) });
        } catch {
            ground = await db.collection("playgrounds").findOne({ id: id });
        }

        if (!ground) {
            return res.status(404).json({ success: false, message: "Playground not found" });
        }

        // Ownership Check
        if (req.user.role !== 'admin' && ground.ownerId !== req.user.id && ground.ownerEmail !== req.user.email) {
            return res.status(403).json({ success: false, message: "Forbidden. You can only delete your own playgrounds." });
        }

        await db.collection("playgrounds").deleteOne({ _id: ground._id });
        res.json({ success: true, message: "Playground deleted successfully!" });
    } catch (error) {
        console.error("Error deleting playground:", error);
        res.status(500).json({ success: false, message: "Server error deleting playground" });
    }
});

// ── BOOKINGS ENDPOINTS ──────────────────────────────────────────────────────

// POST Create Booking (Authenticated)
app.post('/api/bookings', authenticateUser, async (req, res) => {
    try {
        const {
            groundId, groundTitle, groundCity, sportType, pricePerHour,
            bookingDate, startTime, endTime,
            playerName, playerPhone, playerEmail, notes
        } = req.body;

        if (!groundId || !bookingDate || !startTime || !endTime || !playerName || !playerPhone || !playerEmail) {
            return res.status(400).json({ success: false, message: "All required booking fields must be filled." });
        }

        // Conflict check: prevent double-booking same ground on same date/time overlap
        const conflictQuery = {
            groundId,
            bookingDate,
            status: { $nin: ["cancelled", "rejected"] },
            $or: [
                { startTime: { $lt: endTime, $gte: startTime } },
                { endTime: { $gt: startTime, $lte: endTime } },
                { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
            ]
        };
        const conflict = await db.collection("bookings").findOne(conflictQuery);
        if (conflict) {
            return res.status(409).json({ success: false, message: "This time slot is already booked. Please choose a different time." });
        }

        const newBooking = {
            groundId,
            groundTitle: groundTitle || "Unknown Ground",
            groundCity: groundCity || "",
            sportType: sportType || "",
            pricePerHour: Number(pricePerHour) || 0,
            bookingDate,
            startTime,
            endTime,
            playerName,
            playerPhone,
            playerEmail,
            notes: notes || "",
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.name,
            status: "confirmed",
            createdAt: new Date()
        };

        const result = await db.collection("bookings").insertOne(newBooking);
        res.status(201).json({
            success: true,
            message: "Booking confirmed successfully!",
            data: { ...newBooking, _id: result.insertedId }
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ success: false, message: "Server error creating booking" });
    }
});

// GET My Bookings (Authenticated Player)
app.get('/api/bookings/my-bookings', authenticateUser, async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? {}
            : { $or: [{ userId: req.user.id }, { userEmail: req.user.email }] };

        const bookings = await db.collection("bookings").find(query).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ success: false, message: "Error fetching bookings" });
    }
});

// GET Bookings for a Ground (Owner/Admin)
app.get('/api/bookings/ground/:groundId', authenticateUser, async (req, res) => {
    try {
        const { groundId } = req.params;
        const bookings = await db.collection("bookings").find({ groundId }).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching ground bookings" });
    }
});

// GET All Bookings (Admin only)
app.get('/api/bookings', authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Admin access required." });
        }
        const bookings = await db.collection("bookings").find({}).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching all bookings" });
    }
});

// PATCH Update Booking Status (Owner/Admin)
app.patch('/api/bookings/:id/status', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ["confirmed", "pending", "cancelled", "rejected", "completed"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid booking status." });
        }
        let booking;
        try { booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) }); }
        catch { return res.status(404).json({ success: false, message: "Booking not found" }); }
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

        await db.collection("bookings").updateOne({ _id: booking._id }, { $set: { status, updatedAt: new Date() } });
        res.json({ success: true, message: `Booking ${status} successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating booking status" });
    }
});

// ── ADMIN USER MANAGEMENT ENDPOINTS ───────────────────────────────────────

// GET All Users (Admin only)
app.get('/api/admin/users', authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Admin access required." });
        }
        const users = await db.collection("user").find({}).toArray();
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        console.error("Error fetching admin users:", error);
        res.status(500).json({ success: false, message: "Error fetching users" });
    }
});

// DELETE User (Admin only)
app.delete('/api/admin/users/:id', authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Admin access required." });
        }
        const { id } = req.params;
        let query;
        try { query = { _id: new ObjectId(id) }; }
        catch { query = { id: id }; }

        const userToDelete = await db.collection("user").findOne(query);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (userToDelete.id === req.user.id || userToDelete.email === req.user.email) {
            return res.status(400).json({ success: false, message: "You cannot delete your own admin account." });
        }

        await db.collection("user").deleteOne(query);
        res.json({ success: true, message: "User deleted successfully." });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Error deleting user" });
    }
});

// PATCH Change User Role (Admin only)
app.patch('/api/admin/users/:id/role', authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Admin access required." });
        }
        const { id } = req.params;
        const { role } = req.body;
        if (!['user', 'owner', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid role specified." });
        }

        let query;
        try { query = { _id: new ObjectId(id) }; }
        catch { query = { id: id }; }

        await db.collection("user").updateOne(query, { $set: { role, updatedAt: new Date() } });
        res.json({ success: true, message: `User role updated to ${role}.` });
    } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ success: false, message: "Error updating user role" });
    }
});

// ── DELETE CANCEL BOOKING ──────────────────────────────────────────────────
app.delete('/api/bookings/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        let booking;
        try { booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) }); }
        catch { return res.status(404).json({ success: false, message: "Booking not found" }); }
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

        if (req.user.role !== 'admin' && booking.userId !== req.user.id && booking.userEmail !== req.user.email) {
            return res.status(403).json({ success: false, message: "Forbidden. You can only cancel your own bookings." });
        }

        await db.collection("bookings").deleteOne({ _id: booking._id });
        res.json({ success: true, message: "Booking cancelled successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error cancelling booking" });
    }
});

// ── SERVER START ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`PlayZone server running on port ${PORT}`);
});
