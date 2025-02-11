// server.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { connectDB } = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import models
const Kindergarten = require('./models');
const User = require('./models/user');
const NotificationPreference = require('./models/notificationPreference');

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.id });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// Kindergarten routes
app.get('/api/kindergartens', async (req, res) => {
  try {
    const {
      region,
      ageGroup,
      hasAvailability,
      lat,
      lng,
      maxDistance,
      limit = 20,
      offset = 0
    } = req.query;

    let query = {};

    // Filter by region
    if (region) {
      query['spotHistory.region'] = region;
    }

    // Filter by age group
    if (ageGroup) {
      query['spotHistory.ageGroup'] = ageGroup;
    }

    // Filter by availability
    if (hasAvailability === 'true') {
      query['spotHistory.status'] = 'available';
    }

    // Geospatial query if coordinates provided
    if (lat && lng && maxDistance) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const distanceNum = parseFloat(maxDistance);

      query.koordinatLatLng = {
        $geoWithin: {
          $centerSphere: [[lngNum, latNum], distanceNum / 6378.1]
        }
      };
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const kindergartens = await Kindergarten
      .find(query)
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const total = await Kindergarten.countDocuments(query);

    res.json({
      data: kindergartens,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Kindergarten query error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kindergartens/:id', async (req, res) => {
  try {
    const kindergarten = await Kindergarten.findById(req.params.id);
    if (!kindergarten) {
      return res.status(404).json({ error: 'Kindergarten not found' });
    }
    res.json(kindergarten);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Availability routes
app.get('/api/availability', async (req, res) => {
  try {
    const { region, ageGroup, date } = req.query;
    
    let query = {
      'spotHistory.status': 'available'
    };

    if (region) query['spotHistory.region'] = region;
    if (ageGroup) query['spotHistory.ageGroup'] = ageGroup;
    if (date) query['spotHistory.availabilityDate'] = date;

    const kindergartens = await Kindergarten.find(query);
    res.json(kindergartens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({
      email,
      password: await bcrypt.hash(password, 10),
      name
    });

    await user.save();
    
    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notification preferences routes
app.get('/api/preferences', auth, async (req, res) => {
  try {
    const preferences = await NotificationPreference.find({ userId: req.user._id });
    res.json(preferences || []);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/preferences', auth, async (req, res) => {
  try {
    // Validate required fields
    const { type, parameters } = req.body;
    if (!type || !parameters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create new preference with validated data
    const preference = new NotificationPreference({
      userId: req.user._id,
      type,
      parameters,
      isEnabled: req.body.isEnabled ?? true
    });

    // Save and return
    await preference.save();
    res.status(201).json(preference);
  } catch (error) {
    console.error('Preference creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/preferences/:id', auth, async (req, res) => {
  try {
    const updates = req.body;
    const preference = await NotificationPreference.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user._id 
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!preference) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    res.json(preference);
  } catch (error) {
    console.error('Preference update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/preferences/:id', auth, async (req, res) => {
  try {
    const preference = await NotificationPreference.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!preference) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    res.json({ message: 'Preference deleted successfully' });
  } catch (error) {
    console.error('Preference deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export the app and database connection function
module.exports = { app, connectDB };

// Only start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  connectDB(process.env.MONGO_URI).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}