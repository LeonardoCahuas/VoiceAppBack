const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require("fs")
const fsp = require('fs/promises'); 
const { google } = require('googleapis');

const filePath = path.join(__dirname, 'uploads', 'audio.wav');
dotenv.config();



const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb+srv://adminleo:lFFL9PLkKrNAdXNS@resapp.0tdhejh.mongodb.net/', { useNewUrlParser: true, useUnifiedTopology: true });

// Assicurati che la cartella 'uploads' esista
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

// Configurazione di Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },

});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // per i file
        fieldSize: 1 * 1024 * 1024  // per i campi di testo
    }
});
const keyFile = require('./credentials.json');
const drive = google.drive({
    version: 'v3',
    auth: new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/drive'],
    }),
  });

// Rotta per l'upload del file
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Nessun file caricato.');
        }

        const filePath = path.join(__dirname, 'uploads', req.file.originalname);

        // Controllo dell'esistenza del file e della sua dimensione
        try {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Breve attesa per la disponibilità del file
            await fsp.access(filePath, fs.constants.F_OK); // Controlla se il file esiste
            const stats = await fsp.stat(filePath); // Ottiene le statistiche del file
            if (stats.size === 0) {
                throw new Error("Il file non è stato completamente scritto su disco.");
            }
        } catch (error) {
            console.error('Errore durante la lettura del file:', error);
            return res.status(500).send('Errore durante il caricamento del file.');
        }

        // Procedi con il caricamento del file su Google Drive
        const folderId = req.body.folderId;
        if (!folderId) {
            return res.status(400).send('ID della cartella non fornito.');
        }

        const fileMetadata = {
            name: req.file.originalname,
            parents: [folderId],
        };

        const media = {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(filePath),
        };

        const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
        });

        // Opzionale: Elimina il file dal server dopo il caricamento
        //await fsp.unlink(filePath);

        res.status(200).json({ fileId: driveResponse.data.id });
    } catch (error) {
        console.error('Errore generale:', error);
        res.status(500).send('Errore durante il caricamento del file.');
    }
});
// Gestione degli errori nella pipeline di Express
app.use((error, req, res, next) => {
    if (error) {
        console.error('Errore nella pipeline di Express:', error);
        return res.status(500).send({ error: error.message });
    }
    next();
});



app.get('/download/:folderId', async (req, res) => {
    try {
        const folderId = req.params.folderId;

        // Qui dovresti avere la logica per autenticarti con Google Drive
        // e ottenere l'elenco dei file nella cartella specificata
        // Assumiamo che tu stia usando il client Google Drive API
        const fileList = await drive.files.list({
            q: `'${folderId}' in parents`,
            // fields: 'files(id, name, mimeType)', // Aggiungi i campi che ti servono
        });

        // Assicurati che ci sia almeno un file nella cartella
        if (fileList.data.files.length === 0) {
            return res.status(404).send('Nessun file trovato nella cartella.');
        }

        // Prendi il primo file dalla lista (o applica la tua logica per selezionare un file)
        const file = fileList.data.files[0];

        // Scarica il file
        const driveResponse = await drive.files.get({
            fileId: file.id,
            alt: 'media',
            // headers: { Authorization: `Bearer YOUR_ACCESS_TOKEN` }
        }, { responseType: 'stream' });

        // Imposta gli header per il download
        res.setHeader('Content-Disposition', `attachment; filename=${file.name}`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Invia il file al client
        driveResponse.data.pipe(res);
    } catch (error) {
        console.error('Errore nel download:', error);
        res.status(500).send('Errore durante il download del file.');
    }
});


 




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


