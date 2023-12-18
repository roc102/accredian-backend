const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex');

const db = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1', 
      user : 'postgres', 
      password : 'password', 
      database : 'accredian' 
    }
});

const app = express();

const database = {
    users: [
        {
            id : '123',
            name : 'John',
            email : 'john@gmail.com',
            password : 'Cookies@123',
            entries : 0,
            joined : new Date()
        },
        {
            id : '124',
            name : 'Sally',
            email : 'sally@gmail.com',
            password : 'bananas',
            entries : 0,
            joined : new Date()
        }
    ]
}

app.use(bodyParser.json());
app.use(cors());

app.get('/',(req,res) => {
    res.send(database.users);
})

app.post('/signin', (req, res) => {
    const { username_or_email, password } = req.body;

    // Validate username_or_email and password
    if (!username_or_email.trim() || !password.trim()) {
        return res.status(400).json('Please enter both username_or_email and password');
    }

    // Check if the username_or_email exists in the login table
    db.select('username_or_email', 'password').from('login')
        .where('username_or_email', '=', username_or_email)
        .then(data => {
            if (data.length === 0) {
                return res.status(400).json('User not found');
            }

            const isValid = bcrypt.compareSync(password, data[0].password);
            if (isValid) {
                // If the password is valid, you can return user data or a success message
                // For simplicity, let's just return a success message
                res.json('User signed in successfully!');
            } else {
                res.status(400).json('Wrong credentials');
            }
        })
        .catch(err => res.status(400).json('Error finding user'));
});


app.post('/register', (req, res) => {
    const { email, password, username } = req.body;

    console.log('Request Body:', req.body);
    const hash = bcrypt.hashSync(password);

    // Check if the email already exists
    db.transaction(trx => {
        trx.select('*').from('login').where('username_or_email', '=', email)
            .then(existingEmail => {
                console.log('Existing email:', existingEmail);

                if (existingEmail.length > 0) {
                    trx.rollback();
                    return res.status(400).json('Email already exists');
                }

                // Check if the username already exists
                return trx.select('*').from('users').where('username', '=', username)
                    .then(existingUsername => {
                        console.log('Existing username:', existingUsername);

                        if (existingUsername.length > 0) {
                            trx.rollback();
                            return res.status(400).json('Username already exists');
                        }

                        // If email and username don't exist, proceed with registration
                        return trx.insert({
                            username_or_email: email,
                            password: hash
                        })
                            .into('login')
                            .returning(['username_or_email', 'password'])
                            .then(loginData => {
                                return trx('users')
                                    .returning('*')
                                    .insert({
                                        email: loginData[0].username_or_email,
                                        username: username,
                                        password: loginData[0].password
                                    })
                                    .then(user => {
                                        trx.commit();
                                        res.json(user[0]);
                                    })
                                    .catch(err => {
                                        console.error('Error inserting user into users table:', err);
                                        trx.rollback();
                                        res.status(400).json('Unable to register user: Error inserting user into users table');
                                    });
                            })
                            .catch(err => {
                                console.error('Error inserting user into login table:', err);
                                trx.rollback();
                                res.status(400).json('Unable to register user: Error inserting user into login table');
                            });
                    });
            })
            .catch(err => {
                console.error('Error checking existing email:', err);
                trx.rollback();
                res.status(400).json('Unable to register user: Error checking existing email');
            });
    })
    .catch(err => {
        console.error('Transaction error:', err);
        res.status(400).json('Unable to register user: Transaction error');
    });
});


app.get('/profile/:id', (req,res) => {

    const {id} = req.params;

    db.select('*').from('users').where({id})
    .then(user => {
        if(user.length) {
            res.json(user[0].id)
        }
        else {
            res.status(400).json('not found')
        }
    })
    .catch(err => res.status(400).json('error getting user'))
})


app.listen(3001);