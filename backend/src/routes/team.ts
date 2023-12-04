import express from 'express';
import { PrismaClient, Team } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
	const { id } = req.body;
	try {
		const team = await prisma.team.findFirst({
		  where: {
			id: parseInt(id, 10),
		  },
		});
		res.json(team);
	} catch (error) {
		console.error("Error updating team:", error);
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
