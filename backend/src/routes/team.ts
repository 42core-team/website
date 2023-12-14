import express from 'express';
import session from 'express-session';
import { PrismaClient, Team } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.use(
	session({
		secret: process.env.SESSION_SECRET || 'your-secret-key',
		resave: false,
		saveUninitialized: true,
	})
);

router.get('/', async (req, res) => {
	let token = req.cookies.access_token;
	if (!token) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	try {
		const team = await prisma.team.findFirst({
			where: {
				tokens: {
					some: {
						token: token,
					},
				}
			}
		});
		if (!team) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}
		res.json(team);
	} catch (error) {
		console.error("Error getting team:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.post('/', async (req, res) => {
	try {
	  const team: Team = await prisma.team.create({
		data: {
		  name: req.body.name ? req.body.name : '',
		  repo_url: req.body.repo_url ? req.body.repo_url : '',
		},
	  });
	  console.log(team);
  
	  return res.status(200).send(team);
	} catch (error) {
	  console.error('Error creating team:', error);
	  return res.status(500).send('Internal Server Error');
	}
  });

router.put('/', async (req, res) => {
	const { id, name, repo_url } = req.body;
	try {
		const team: Team = await prisma.team.update({
			where: {
				id: parseInt(id, 10),
			},
			data: {
				name: name,
				repo_url: repo_url,
			},
		});
		res.json(team);
	} catch (error) {
		console.error("Error updating team:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});


router.delete('/', (req, res) => {
  return res.status(200).send('Received a DELETE HTTP method');
});

export default router;
