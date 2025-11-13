// server.js
import 'dotenv/config'; 
import express from 'express';
import bodyParser from 'body-parser';
import { getMatches, createMatch } from './controllers/matchController.js';

const app = express();
app.use(bodyParser.json());

app.get('/match', getMatches);       // GET /match?user_id=...
app.post('/matches', createMatch);   // POST /matches

// health
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
