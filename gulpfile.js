const Gulp = require('gulp');
const Sass = require('gulp-sass');
const Pug = require('pug');
const Concat = require('gulp-concat');
const BrowserSync = require('browser-sync').create();
const Glob = require('glob');
const Path = require('path');
const Del = require('del');
const FS = require('fs');
const pack = require('./package.json');

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

Gulp.task('js', () => {
  return Gulp
    .src('src/**/*.js')
    .pipe(Gulp.dest('./dest'));
});

Gulp.task('vendor', () => {
  return Gulp
    .src('vendor/**/*')
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
  data._version = pack.version.split('.')[0] + '.' + data._version;
  return card_compiles[data._template](data);
}

function findDuplicates(arr) {
  let sorted_arr = arr.slice().sort(); // You can define the comparing function here. 
  // JS by default uses a crappy string compare.
  // (we use slice to clone the array so the
  // original array won't be modified)
  let results = [];
  for (let i = 0; i < sorted_arr.length - 1; i++) {
    if (sorted_arr[i + 1] == sorted_arr[i]) {
      results.push(sorted_arr[i]);
    }
  }
  return results;
}

Gulp.task('generate', (cb) => {
  card_compiles = {};
  const files = Glob.sync('data/**/*.json', {absolute: true});
  const index = Pug.compileFile('src/index.pug');
  const page = Pug.compileFile('src/page.pug');
  const links = [];
  const full = [];
  const prints = [];
  const all_cards = [];
  let serial = 0;
  const serials = [];

  for (const file of files) {
    delete require.cache[require.resolve(file)];
    const name = Path.parse(file).name;

    const cards = [];
    const data = require(file);
    for (const index in data) {
      try {
        const card = data[index];
        if (typeof card._serial !== 'undefined') {
          card._serial = parseInt(card._serial);
          if (card._serial) {
            serial = card._serial > serial ? card._serial : serial;
            serials.push(card._serial);
          }
        }
        card._index = parseInt(index) + 1;
        card._count = card._count || 1;
        card._type = name;
        cards.push(getCard(card, false));
        for (let i = 0; i < card._count; i++) {
          full.push(card);
        }
      } catch (e) {
        cards.push(getCard({card: 'error', message: e.message, stack: e.stack}));
      }
      all_cards.push(cards[cards.length - 1]);
    }

    links.push({url: name + '.html', name: name + ' (' + cards.length + ')'});
    FS.writeFileSync(Path.join('./dest', name + '.html'), page({cards, print: false, type: 'generate'}));
  }

  links.unshift({url: 'all.html', name: 'all (' + all_cards.length + ')'});
  FS.writeFileSync(Path.join('./dest', 'all.html'), page({cards: all_cards, print: false, type: 'generate'}));

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

    FS.writeFileSync(Path.join('./dest', name + '.html'), page({cards, print: true, type: 'print', hide_form: true}));
  }

  const missing_serial = [];
  for (let i = 1; i < serial; i++) {
    if (!serials.includes(i)) {
      missing_serial.push(i);
    }
  }

  FS.writeFileSync('./dest/index.html', index({links, prints, hide_form: true, serial: serial, missing: missing_serial, duplicates: findDuplicates(serials)}));

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

Gulp.task('serve', Gulp.series('cleanup', 'files', 'sass', 'js', 'generate', 'vendor', (finished) => {
  BrowserSync.init({
    server: {
      baseDir: './dest',
    }
  });

  Gulp.watch(['files/**/*', '!files/**/*.crdownload'])
    .on('change', fcopy)
    .on('add', fcopy)
    .on('unlink', fdel);
  Gulp.watch('src/**/*.sass', Gulp.series('sass'));
  Gulp.watch('src/**/*.js', Gulp.series('js'));
  Gulp.watch('src/**/*.pug', Gulp.series('generate'));
  Gulp.watch('data/**/*.json', Gulp.series('generate'));
  Gulp.watch('dest/**/*').on('change', BrowserSync.reload);
  finished();
}));