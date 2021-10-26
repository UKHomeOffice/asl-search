const fs = require('fs');
const path = require('path');

const corpus = fs.readFileSync(path.resolve(__dirname, './text.txt')).toString('utf8').split(/\W/).filter(Boolean);

const between = (min, max) => {
  return min + Math.floor(Math.random() * (max - min));
};

const randomWord = predecessor => {
  if (predecessor) {
    const successors = corpus
      .map((word, i) => word.toLowerCase() === predecessor.toLowerCase() ? corpus[i + 1] : null)
      .filter(Boolean);
    if (successors.length) {
      return successors[between(0, successors.length)];
    }
  }
  return corpus[between(0, corpus.length)];
};

const words = n => {
  const output = [];
  let last;
  while (output.length < n) {
    last = randomWord(last);
    output.push(last);
  }
  return output.join(' ');
};

const sentence = (min = 10, max = 60, newline = true) => {
  const txt = words(between(min, max)) + '.';
  return txt.replace(/^\w/, c => c.toUpperCase()) + (newline ? '\n' : '');
};

const paragraphs = (min = 1, max = 3, { words } = {}) => {
  words = words || [];
  const result = [];
  const minWords = words[0] || 10;
  const maxWords = words[1] || 100;
  const len = between(min, max);
  while (result.length < len) {
    result.push(sentence(minWords, maxWords));
  }
  return result;
};

module.exports = {
  words,
  sentence,
  paragraphs
};
