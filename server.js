const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');  // Aggiunta
const dotenv = require('dotenv');  // Aggiunta
const path = require('path');
dotenv.config();  // Aggiunta

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb+srv://adminleo:lFFL9PLkKrNAdXNS@resapp.0tdhejh.mongodb.net/', { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({
    name: String,
    password: String,
    index: String
});

const User = mongoose.model('User', UserSchema);

const VoiceSchema = new mongoose.Schema({
    uuid: {
        type: String,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
});

const Voice = mongoose.model('Voice', VoiceSchema);

const StyleSchema = new mongoose.Schema({
    voiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voice',
        required: true
    },
});

const Style = mongoose.model('Style', StyleSchema);

const RecordingSchema = new mongoose.Schema({
    voiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voice',
        required: true
    },
    styleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Style'
    },
});

const Recording = mongoose.model('Recording', RecordingSchema);

// Middleware per l'autenticazione JWT
function authenticateToken(req, res, next) {  // Aggiunta
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}  // Aggiunta

app.post('/users', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({ name: req.body.name, password: hashedPassword });
        await user.save();
        res.status(201).send();
    } catch {
        res.status(500).send();
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ name: req.body.name });
        if (!user) {
            return res.status(400).send({ success: false, message: 'Incorrect name or password' });
        }

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) {
            return res.status(400).send({ success: false, message: 'Incorrect name or password' });
        }

        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);  // Modifica

        res.status(200).send({ success: true, message: 'Logged in successfully', userId: user._id, token, index: user.index });  // Modifica
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.get('/users/:userId/voices', authenticateToken, async (req, res) => {  // Modifica
    try {
        const voices = await Voice.find({ userId: req.params.userId });
        res.status(200).send(voices);
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.get('/voices/:voiceId/styles', authenticateToken, async (req, res) => {  // Modifica
    try {
        const styles = await Style.find({ voiceId: req.params.voiceId });
        res.status(200).send(styles);
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.get('/styles/:styleId/recordings', authenticateToken, async (req, res) => {  // Modifica
    try {
        const recordings = await Recording.find({ styleId: req.params.styleId });
        res.status(200).send(recordings);
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.get('/voices/:voiceId/recordings', authenticateToken, async (req, res) => {  // Modifica
    try {
        const recordings = await Recording.find({ voiceId: req.params.voiceId });
        res.status(200).send(recordings);
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.post('/voices', async (req, res) => {
    try {
        const voice = new Voice({
            uuid: req.body.uuid,
            userId: req.body.userId
        });
        await voice.save();
        res.status(201).send(voice);
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

app.use(express.static(path.join(__dirname, '../my-react-app/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../my-react-app/dist', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


