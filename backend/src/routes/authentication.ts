import express from 'express';
import session from 'express-session';
import { PrismaClient, Team, Token } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const router = express.Router();
const prisma = new PrismaClient();

import 'express-session';

declare module 'express-session' {
  interface SessionData {
    token?: string; // Add your custom property here
    // Add other custom properties if needed
  }
}


router.use(
	session({
	  secret: process.env.SESSION_SECRET || 'your-secret-key',
	  resave: false,
	  saveUninitialized: true,
	})
  );
  

async function hashPassword(password: string): Promise<string> {
	const saltRounds = 10;
	const hashedPassword = await bcrypt.hash(password, saltRounds);
	return hashedPassword;
}

async function checkPassword(password: string, hashedPassword: string): Promise<boolean> {
	const passwordMatch = await bcrypt.compare(password, hashedPassword);
	return passwordMatch;
}

router.post('/login', async (req, res) => {
	const { name, password } = req.body;

	if(!name || !password) {
		res.status(400).json({ error: 'Invalid request' });
		return;
	}
	
	const login_successfully = checkPassword(password, (await prisma.team.findFirst({ where: { name: name } }))!.password);

	if (!login_successfully) {
		res.status(401).json({ error: 'Invalid credentials' });
		return;
	}
	const team = await prisma.team.findFirst({
		where: {
			name: name
		}
	});
	if(!team) {
		res.status(401).json({ error: 'Invalid credentials' });
		return;
	}
	const token = jwt.sign({ team }, process.env.JWT_SECRET!, { expiresIn: '1h' } as jwt.SignOptions);

	const db_token = await prisma.token.create({
		data: {
			token: token,
			expiration: new Date(Date.now() + 3600000).toISOString(),
			team: {
			connect: {
				id: team!.id,
			},
			},
		},
	});

	return res.cookie("access_token", token, {
		httpOnly: true,
		secure: false,
	}).status(200).json({ token });
});

router.post('/register', async (req, res) => {
	const { name, password, email } = req.body;

	if(!name || !password || !email) {
		res.status(400).json({ error: 'Invalid request' });
		return;
	}
	
	const team = await prisma.team.findFirst({
		where: {
			name: name
		}
	});

	if(team) {
		res.status(409).json({ error: 'Team already exists' });
		return;
	}

	let passwd = await hashPassword(password);

	const new_team = await prisma.team.create({
		data: {
			name: req.body.name,
			password: passwd,
			email: req.body.email
		}
	});
	req.session.token = undefined;
	res.status(200).json({ team: new_team });
});

export default router;