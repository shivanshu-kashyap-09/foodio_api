const express = require('express');
const cors = require('cors');

const thali = require('./routes/thali/thali');
const thaliDish = require('./routes/thali/thaliDish');

const vegRestaurant = require('./routes/restaurant/vegRestaurant');
const nonvegRestaurant = require('./routes/restaurant/nonVegRestaurant');
const southIndianRestaurant = require('./routes/restaurant/southRestaurant');

const vegMenu = require('./routes/menu/vegMenu');
const nonVegMenu = require('./routes/menu/nonVegMenu');
const southIndianMenu = require('./routes/menu/southIndianMenu');

const whishList = require('./routes/user/whishlist');
const cart = require('./routes/user/cart');
const order = require('./routes/user/order');
const user = require('./routes/user/auth');
const contact = require('./routes/user/contact');
const googleAuth = require('./routes/user/GoogleOauth2');

const app = express()
const port = 3000

app.use(cors());
app.use(express.json());


app.use('/thali', thali);
app.use('/thalidish', thaliDish);
app.use('/vegrestaurant', vegRestaurant);
app.use('/nonvegrestaurant', nonvegRestaurant);
app.use('/southindianrestaurants', southIndianRestaurant);
app.use('/vegmenu', vegMenu);
app.use('/nonvegmenu', nonVegMenu);
app.use('/southindianmenu', southIndianMenu);
app.use('/whishlist', whishList);
app.use('/cart', cart);
app.use('/order', order);
app.use('/user', user);
app.use('/contact', contact);
app.use('/auth', googleAuth);

app.use('/uploads', express.static('uploads'));


app.get('/', (req, res) => {
    return res.send('Welcome to foodio!');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});


app.listen(port, () => {
    console.log(`Example app listening on port http://localhost:${port}`)
})
