const mysql = require('mysql');
const data = require('../../../../../Downloads/davidliu-2_1687471819/export.json'); // path to export.json

// Connect to the database
const database = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'password',
    database: 'migrationTest',
    charset: 'utf8mb4'
});

database.connect((err) => {
    if (err) {
        console.log('🚨 Error connecting to database: ', err);
    } else {
        console.log('Connected to database');
    }
});

for (const post of data.data.posts) {
    console.log('Inserting post ' + post.uuid);
    const id = post.uuid;
    const mobiledoc = JSON.stringify(JSON.parse(post.mobiledoc));
    // console.log(mobiledoc);
    database.query('INSERT INTO posts (uuid, mobiledoc) VALUES (?, ?);', [id, mobiledoc], (err, rows) => {
        if (err) {
            throw err;
        } else {
            console.log('Post ' + post.id + ' inserted');
        }
    });
}

database.end();
