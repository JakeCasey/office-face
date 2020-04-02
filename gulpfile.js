const gulp = require('gulp');
watch = require('gulp-watch');

gulp.task('css', function() {
  const postcss = require('gulp-postcss');

  return watch('css/tailwind.css', function() {
    gulp
      .src('css/tailwind.css')
      // ...
      .pipe(
        postcss([
          // ...
          require('tailwindcss'),
          require('autoprefixer'),
          // ...
        ])
      )
      .on('error', function(err) {
        console.log(err.toString());

        this.emit('end');
      })
      .pipe(gulp.dest('build/'))
      .on('end', function() {
        console.log('Build finished. . .');
      });
  });
});
