// server.js
import 'dotenv/config'; 
import express from 'express';
import bodyParser from 'body-parser';
import { getMatches, createMatch, getUserMatches, acceptMatch, rejectMatch } from './controllers/matchController.js';

const app = express();
app.use(bodyParser.json());

app.get('/match', getMatches);       // GET /match?user_id=...
app.post('/matches', createMatch);   // POST /matches
app.get('/matches', getUserMatches);        // GET /matches?user_id=...
app.patch('/matches/:id/accept', acceptMatch);
app.patch('/matches/:id/reject', rejectMatch);
// health
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
