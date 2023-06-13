// Main module file
const mobiledocLib = require('../../core/core/server/lib/mobiledoc');
const lexicalLib = require('../../core/core/server/lib/lexical');
const mobiledocToLexical = require('@tryghost/kg-converters').mobiledocToLexical;
const mysql = require('mysql');
const {assertHTML} = require('./utils');

const database = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'password',
    database: 'database-name'
});

database.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }

    console.log('connected as id ' + database.threadId);
});

database.query('SELECT mobiledoc FROM posts;', function (error, results, fields) {
    if (error) {
        throw error;
    }

    for (let i = 0; i < results.length; i++) {
        const mobiledoc = results[i].mobiledoc;
        const mobiledocHtml = renderMobiledocToHtml(mobiledoc);
        const lexicalHtml = renderConvertedMobiledocToHtml(mobiledoc);
        assertHTML(mobiledocHtml, lexicalHtml);
    }
});

const renderMobiledocToHtml = function (mobiledoc) {
    return mobiledocLib.mobiledocHtmlRenderer.render(JSON.parse(mobiledoc));
};

const renderConvertedMobiledocToHtml = function (mobiledoc) {
    const lexical = mobiledocToLexical(mobiledoc);
    return lexicalLib.render(lexical);
};

const compareRenderedHtml = function (mobiledoc) {
    const mobiledocHtml = renderMobiledocToHtml(mobiledoc);
    const lexicalHtml = renderConvertedMobiledocToHtml(mobiledoc);
    return assertHTML(mobiledocHtml, lexicalHtml);
};

module.exports = {
    renderMobiledocToHtml,
    renderConvertedMobiledocToHtml,
    compareRenderedHtml
};