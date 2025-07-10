# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Engaged Philosophy" - a WordPress theme modernized with Bootstrap 5. It's a custom theme derived from "The Bootstrap" theme by Konstantin Obenland, customized for philosophy-related content and updated with modern build tools.

## Build System

### Modern Build (Recommended)
- **Build command**: `npm run build` or `./build-modern.sh`
  - Compiles SCSS files from `src/scss/` to CSS
  - Bundles JavaScript modules from `src/js/`
  - Integrates Bootstrap 5 from npm
  - Generates optimized assets in `build/` directory
  - Copies compiled files to WordPress theme structure

### Development Workflow
- **Development server**: `npm run start` or `./dev-watch.sh`
  - Hot reloading for CSS and JavaScript changes
  - Source maps for debugging
  - Automatic browser refresh
  - Modern webpack-based build system

### Dependencies
- **Modern stack**: `@wordpress/scripts` (official WordPress build tool)
- **Bootstrap 5**: Latest version from npm
- **Node.js**: For build tooling and package management

### Legacy Build (Deprecated)
- **Old build**: `./regen-theme.sh` (uses outdated LESS compiler)
- **Old watch**: `./watch-and-rebuild.sh` (uses inotify)
- These scripts are maintained for compatibility but should be replaced with modern build

## Architecture

### WordPress Theme Structure
- **Main theme files**: Standard WordPress theme structure with PHP templates
- **Styling**: Modern SCSS-based build system with Bootstrap 5 foundation
- **Custom content**: Supports custom post types including `project` taxonomy and post formats

### Key Components
- **SCSS compilation**: 
  - Main file: `src/scss/style.scss`
  - Custom theme styles: `src/scss/` directory with partials
  - Bootstrap 5: Integrated from npm package
- **JavaScript**: Modern ES6 modules with Bootstrap 5 components
- **Localization**: Multi-language support in `lang/` directory
- **Custom functionality**: Theme hooks, custom post formats, responsive design

### File Organization
- **Templates**: PHP files in root, partials in `partials/`
- **Includes**: Theme functions and utilities in `inc/`
- **Modern source**: SCSS files in `src/scss/`, JS modules in `src/js/`
- **Build output**: Compiled assets in `build/`, copied to theme root
- **Legacy source**: Old LESS files in `less/` (deprecated)
- **Assets**: Images in `img/`, compiled CSS/JS in root

## WordPress Requirements
- WordPress 5.0+ (for modern block editor support)
- PHP 7.4+ (for modern PHP features)
- Node.js 16+ (for build tooling)
- Custom post formats support: aside, chat, link, gallery, status, quote, image, video

## Styling Guidelines
- **Prefer Bootstrap 5 utility classes** over custom CSS whenever possible
- Use classes like `px-4`, `py-3`, `mb-4`, `text-center`, `bg-light`, `border`, etc. instead of writing custom CSS
- Bootstrap provides extensive utility classes for spacing, colors, borders, typography, and layout
- Only add custom CSS when Bootstrap utilities are insufficient for the specific requirement
- Keep custom CSS minimal, well-documented, and scoped to specific components
- Always check Bootstrap documentation for existing utility classes before writing custom styles

## Getting Started
1. **Install dependencies**: `npm install`
2. **Development**: `npm run start` or `./dev-watch.sh`
3. **Production build**: `npm run build` or `./build-modern.sh`
4. **Code linting**: `npm run lint:css` and `npm run lint:js`