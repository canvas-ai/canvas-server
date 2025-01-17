import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'v2 API is working with provided access token.' });
});

export default router;
