const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ email: user.email, sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), passwordHash });
  res.status(201).json({ token: issueToken(user), email: user.email });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  res.json({ token: issueToken(user), email: user.email });
}));

module.exports = router;
