// tests/api.test.js
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, connectDB } = require('../server');
const { disconnectDB, clearDB } = require('../config/database');
const User = require('../models/user');
const Kindergarten = require('../models');
const NotificationPreference = require('../models/notificationPreference');

let mongoServer;
let token;
let userId;
let kindergartenId;

beforeAll(async () => {
  // Setup in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await connectDB(mongoUri);
});

afterAll(async () => {
  await disconnectDB();
  await mongoServer.stop();
});

beforeEach(async () => {
  await clearDB();
  
  // Create test data
  const testUser = await request(app)
    .post('/api/users/register')
    .send({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });
  
  token = testUser.body.token;
  userId = testUser.body.user._id;

  // Create test kindergarten with coordinates in [longitude, latitude] order
  const kindergarten = new Kindergarten({
    orgnr: '123456789',
    navn: 'Test Kindergarten',
    koordinatLatLng: [10.7522, 59.9139], // Changed order to [longitude, latitude]
    spotHistory: [{
      region: 'Oslo',
      discoveredAt: new Date(),
      lastSeenAt: new Date(),
      spots: 2,
      ageGroup: 'under 3 years',
      availabilityDate: 'now',
      status: 'available',
      spotId: '123'
    }]
  });
  await kindergarten.save();
  kindergartenId = kindergarten._id;
});

describe('Authentication Endpoints', () => {
  test('POST /api/users/register - Success', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'new@example.com');
  });

  test('POST /api/users/login - Success', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/users/login - Invalid credentials', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
  });
});

describe('Kindergarten Endpoints', () => {
  test('GET /api/kindergartens - List all', async () => {
    const res = await request(app)
      .get('/api/kindergartens');

    if (res.status !== 200) {
      console.error('List all error:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(1);
  });

  test('GET /api/kindergartens - Filter by region', async () => {
    const res = await request(app)
      .get('/api/kindergartens')
      .query({ region: 'Oslo' });

    if (res.status !== 200) {
      console.error('Region filter error:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('GET /api/kindergartens - Filter by distance', async () => {
    // First ensure we have valid test data
    const testKindergarten = await Kindergarten.findById(kindergartenId);
    if (!testKindergarten) {
      console.error('Test kindergarten not found');
      throw new Error('Test data not properly set up');
    }

    const [lng, lat] = testKindergarten.koordinatLatLng; // Already in [longitude, latitude] order
    
    const res = await request(app)
      .get('/api/kindergartens')
      .query({ 
        lat,
        lng,
        maxDistance: 1 // 1km radius
      });

    if (res.status !== 200) {
      console.error('Distance filter error:', res.body);
      console.error('Query params:', { lat, lng, maxDistance: 1 });
    }
    
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('GET /api/kindergartens/:id - Get specific', async () => {
    const res = await request(app)
      .get(`/api/kindergartens/${kindergartenId}`);

    if (res.status !== 200) {
      console.error('Get specific error:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('navn', 'Test Kindergarten');
  });
});

describe('Availability Endpoint', () => {
  test('GET /api/availability - Filter by region and age group', async () => {
    const res = await request(app)
      .get('/api/availability')
      .query({ 
        region: 'Oslo',
        ageGroup: 'under 3 years'
      });

    if (res.status !== 200) {
      console.error('Availability filter error:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
  });
});

describe('Notification Preferences Endpoints', () => {
  test('POST /api/preferences - Create new preference', async () => {
    const preference = {
      type: 'region',
      parameters: {
        region: 'Oslo',
        ageGroup: 'under 3 years'
      },
      isEnabled: true
    };

    const res = await request(app)
      .post('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send(preference);

    if (res.status !== 201) {
      console.error('Preference creation error:', res.body);
    }
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
  });

  test('GET /api/preferences - List user preferences', async () => {
    // First create a test preference
    await request(app)
      .post('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'region',
        parameters: {
          region: 'Oslo'
        },
        isEnabled: true
      });

    const res = await request(app)
      .get('/api/preferences')
      .set('Authorization', `Bearer ${token}`);

    if (res.status !== 200) {
      console.error('List preferences error:', res.body);
      console.error('Auth token:', token);
    }
    
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
  });

  test('PUT /api/preferences/:id - Update preference', async () => {
    // First create a preference
    const createRes = await request(app)
      .post('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'region',
        parameters: {
          region: 'Oslo'
        },
        isEnabled: true
      });

    const updateRes = await request(app)
      .put(`/api/preferences/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        isEnabled: false
      });

    if (updateRes.status !== 200) {
      console.error('Update preference error:', updateRes.body);
    }
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.isEnabled).toBe(false);
  });

  test('DELETE /api/preferences/:id - Delete preference', async () => {
    // First create a preference
    const createRes = await request(app)
      .post('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'region',
        parameters: {
          region: 'Oslo'
        },
        isEnabled: true
      });

    const deleteRes = await request(app)
      .delete(`/api/preferences/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);

    if (deleteRes.status !== 200) {
      console.error('Delete preference error:', deleteRes.body);
    }
    expect(deleteRes.status).toBe(200);
  });
});