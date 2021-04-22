const Gulp = require('gulp');
const Sass = require('gulp-sass');
const Pug = require('pug');
const Concat = require('gulp-concat');
const BrowserSync = require('browser-sync').create();
const Glob = require('glob');
const Path = require('path');
const Del = require('del');
const FS = require('fs');

Gulp.task('cleanup', () => {
  return Del(['dest/**', '!dest']);
});

Gulp.task('sass', () => {
  return Gulp
    .src('src/**/*.sass')
    .pipe(Sass())
    .pipe(Concat('styles.css'))
    .pipe(Gulp.dest('./dest'));
});

let card_compiles = {};
function getCard(data, _print = false) {
  data._card = data._card || 'default';
  data._template = data._template || (data._card === 'default' ? 'card.pug' : 'card__' + data._card + '.pug');
  if (card_compiles[data._template] === undefined) {
    card_compiles[data._template] = Pug.compileFile('src/' + data._template);
  }
  data._print = _print;
  return card_compiles[data._template](data);
}

Gulp.task('generate', (cb) => {
  card_compiles = {};
  const files = Glob.sync('data/**/*.json', {absolute: true});
  const index = Pug.compileFile('src/index.pug');
  const page = Pug.compileFile('src/page.pug');
  const links = [];
  const full = [];
  const prints = [];

  for (const file of files) {
    delete require.cache[require.resolve(file)];
    const name = Path.parse(file).name;

    const cards = [];
    const data = require(file);
    for (const card of data) {
      try {
        card._count = card._count || 1;
        cards.push(getCard(card, false));
        for (let i = 0; i < card._count; i++) {
          full.push(card);
        }
      } catch (e) {
        cards.push(getCard({card: 'error', message: e.message, stack: e.stack}));
      }
    }

    links.push({url: name + '.html', name: name + ' (' + cards.length + ')'});
    FS.writeFileSync(Path.join('./dest', name + '.html'), page({cards, print: false}));
  }

  const chunks = getChunk(full, 9);
  for (const index in chunks) {
    const chunk = chunks[index];
    const name = 'print-' + (parseInt(index) + 1);
    prints.push({url: name + '.html', name: name + ' (' + chunk.length + ')'});

    const cards = [];
    for (const card of chunk) {
      try {
        cards.push(getCard(card, true));
      } catch (e) {
        cards.push(getCard({card: 'error', message: e.message, stack: e.stack}));
      }
    }

    FS.writeFileSync(Path.join('./dest', name + '.html'), page({cards, print: true}));
  }

  FS.writeFileSync('./dest/index.html', index({links, prints}));

  cb();
});

function getChunk(array, size) {
  return array.reduce((target, item, index) => {
    const delta = Math.floor(index / size);
    if (!target[delta]) target.push([]);
    target[delta].push(item);
    return target;
  }, []);
}

const fcopy = (file) => {
  console.log('[COPY]', file);
  FS.writeFileSync(Path.join('dest', file), FS.readFileSync(file));
};
const fdel = (file) => {
  console.log('[DELETE]', file);
  FS.unlinkSync(Path.join('dest', file));
};

Gulp.task('files', () => {
  return Gulp.src('files/**/*')
    .pipe(Gulp.dest('./dest/files'));
});

Gulp.task('serve', Gulp.series('cleanup', 'files', 'sass', 'generate', (finished) => {
  BrowserSync.init({
    server: {
      baseDir: './dest',
    }
  });

  Gulp.watch('files/**/*')
    .on('change', fcopy)
    .on('add', fcopy)
    .on('unlink', fdel);
  Gulp.watch('src/**/*.sass', Gulp.series('sass'));
  Gulp.watch('src/**/*.pug', Gulp.series('generate'));
  Gulp.watch('data/**/*.json', Gulp.series('generate'));
  Gulp.watch('dest/**/*').on('change', BrowserSync.reload);
  finished();
}));