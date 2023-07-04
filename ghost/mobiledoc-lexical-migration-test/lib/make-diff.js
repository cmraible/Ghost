// const gitDiff = require('git-diff');
const fs = require('fs');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

const diff = async (id) => {
    const command = 'git diff --no-index --color=always ./lexical/' + id + '.html ./mobiledoc/' + id + '.html';
    console.log(command);
    const {stdout, stderr} = await exec(command);
    return stdout;
    // return gitDiff(before, after, {color: true, wordDiff: true});
};

const makeDiff = async (mobiledoc, lexical, id) => {
    fs.writeFileSync('./lexical/' + id + '.html', lexical, 'utf8');
    fs.writeFileSync('./mobiledoc/' + id + '.html', mobiledoc, 'utf8');
    const result = await diff(id);
    fs.writeFileSync('./diffs/' + id + '.ansi', result, 'utf8');
};

module.exports = {makeDiff};
