'use strict';

var gulp = require('gulp'),
    del = require('del'),
    concat = require('gulp-concat'),
    rename = require('gulp-rename'),
    ngAnnotate = require('gulp-ng-annotate'),
    uglify = require('gulp-uglify'),
    bump = require('gulp-bump');

gulp.task('clean', function () {
    return del(['dist']);
});

gulp.task('build', ['clean'], function () {
    return gulp
        .src([
            'src/string.polyfill.js',
            'src/module.js',
            'src/provider.js',
            'src/config.js'
        ])
        .pipe(concat('cas-authenticated-api.js'))
        .pipe(ngAnnotate())
        .pipe(gulp.dest('dist'))
        .pipe(uglify())
        .pipe(rename('cas-authenticated-api.min.js'))
        .pipe(gulp.dest('dist'));
});

gulp.task('default', ['build']);

gulp.task('bump', function () {
    return gulp.src(['./bower.json', './package.json'])
        .pipe(bump({type: 'patch'}))
        .pipe(gulp.dest('./'));
});

gulp.task('watch', function () {
    gulp.watch('src/**/*.js', ['build']);
});
