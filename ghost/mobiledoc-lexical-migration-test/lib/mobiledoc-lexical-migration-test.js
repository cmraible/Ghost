// Main module file
const mobiledocLib = require('../../core/core/server/lib/mobiledoc');
const lexicalLib = require('../../core/core/server/lib/lexical');
const mobiledocToLexical = require('@tryghost/kg-converters').mobiledocToLexical;
const {assertHTML} = require('./utils');
const fs = require('fs');
const path = require('path');
const posts = require('./data/posts.json');

// Clear out past results and recreate the results directory
const resultsPath = path.join(__dirname, 'results');
if (fs.existsSync(resultsPath)) {
    fs.rmSync(resultsPath, {recursive: true});
}
if (!fs.existsSync(resultsPath)) {
    fs.mkdirSync(resultsPath, {recursive: true});
}

const testPosts = async function () {
    let failures = 0;
    for (let i = 0; i < posts.length; i++) {
        console.log('Comparing post ' + i + ' id ' + posts[i].uuid);
        const mobiledoc = posts[i].mobiledoc;
        const mobiledocHtml = mobiledocLib.mobiledocHtmlRenderer.render(JSON.parse(mobiledoc));
        let lexical = {};
        try {
            lexical = mobiledocToLexical(mobiledoc);
        } catch (err) {
            console.log('🚨 Error converting mobiledoc to lexical: ', err);
        }
        const lexicalHtml = lexicalLib.render(lexical);
        const result = await assertHTML(posts[i].uuid, mobiledocHtml, lexicalHtml, mobiledoc, lexical);
        if (!result) {
            failures += 1;
        }
    }
    console.log('Total Posts: ' + results.length);
    console.log('Failures: ' + failures);
    console.log('Success Rate: ' + (results.length - failures) / results.length);
};

testPosts();