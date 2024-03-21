const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet'); // Import the Tweet model
const passport = require('passport');
const session = require('express-session'); // Require express-session
const flash = require('connect-flash'); // Require connect-flash
const bcrypt = require('bcrypt');
const Comment = require('./models/Comment');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));



const app = express();
const port = 3000;

// Set up view engine
app.set('view engine', 'ejs');

// Parse incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  

// Array to store tweets
let tweets = [];

// GET route for the home page
app.get('/', async (req, res) => {
    try {
      const tweets = await Tweet.find().sort({ createdAt: -1 }).populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'email'
        }
      });
      res.render('index', { tweets: tweets, req: req });
    } catch (err) {
      console.error('Error retrieving tweets:', err);
      res.status(500).send('Error retrieving tweets');
    }
  });
  

// POST route for handling tweet submissions
// app.post('/tweet', (req, res) => {
//   const newTweet = req.body.tweet;
//   console.log(newTweet);
//   tweets.push(newTweet);
//   res.redirect('/'); // Redirect back to the home page
// });

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

app.post('/tweet', async (req, res) => {
    if (!req.user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    const newTweet = new Tweet({
      content: req.body.tweet,
      author: req.user.email // Add author field to the Tweet model
    });
  
    try {
      await newTweet.save();
      res.redirect('/');
    } catch (err) {
      console.error('Error saving tweet:', err);
      res.status(500).send('Error saving tweet');
    }
  });

  const LocalStrategy = require('passport-local').Strategy;
  const User = require('./models/User');
  
  passport.use(new LocalStrategy({
    usernameField: 'email'
  }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      if (!await bcrypt.compare(password, user.password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser((id, done) => {
    User.findById(id)
      .then(user => {
        done(null, user);
      })
      .catch(err => {
        done(err);
      });
  });

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash() });
  });
  
  app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  }));
  
  app.get('/signup', (req, res) => {
    res.render('signup', { messages: req.flash() });
  });
  
  app.post('/signup', async (req, res) => {
    try {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        req.flash('error', 'Email already exists.');
        return res.redirect('/signup');
      }
  
      const hashedPassword = await bcrypt.hash(req.body.password, 12);
      const newUser = new User({
        email: req.body.email,
        password: hashedPassword
      });
      await newUser.save();
      req.flash('success', 'Account created successfully.');
      res.redirect('/login');
    } catch (err) {
      console.error('Error creating user:', err);
      req.flash('error', 'An error occurred. Please try again.');
      res.redirect('/signup');
    }
  });

  app.get('/logout', (req, res) => {
    req.logout(function(err) {
      if (err) {
        console.error('Error logging out:', err);
      }
      res.redirect('/login');
    });
  });

  app.post('/tweets/:id/like', async (req, res) => {
    if (!req.user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    const tweetId = req.params.id;
  
    try {
      const tweet = await Tweet.findById(tweetId);
      if (!tweet) {
        return res.status(404).send('Tweet not found');
      }
  
      // Check if the user has already liked the tweet
      const isLiked = tweet.likes.some(like => like.equals(req.user._id));
  
      if (isLiked) {
        // Unlike the tweet
        tweet.likes = tweet.likes.filter(like => !like.equals(req.user._id));
        if (tweet.likeCount > 0) { // Only decrement if likeCount is greater than 0
          tweet.likeCount--;
        }
      } else {
        // Like the tweet
        tweet.likes.push(req.user._id);
        tweet.likeCount++;
      }
  
      await tweet.save();
      res.redirect('/'); // Redirect back to the home page
    } catch (err) {
      console.error('Error liking/unliking tweet:', err);
      res.status(500).send('Error liking/unliking tweet');
    }
  });

  app.post('/tweets/:id/comment', async (req, res) => {
    if (!req.user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    }
  
    const tweetId = req.params.id;
    const commentContent = req.body.comment;
  
    try {
      const tweet = await Tweet.findById(tweetId);
      if (!tweet) {
        return res.status(404).send('Tweet not found');
      }
  
      const newComment = new Comment({
        content: commentContent,
        author: req.user._id,
        tweet: tweetId
      });
  
      await newComment.save();
  
      tweet.comments.push(newComment._id);
      await tweet.save();
  
      res.redirect('/'); // Redirect back to the home page
    } catch (err) {
      console.error('Error creating comment:', err);
      res.status(500).send('Error creating comment');
    }
  });