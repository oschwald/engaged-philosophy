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
  - Modular SCSS architecture with 10 semantic partials (see SCSS Architecture below)
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

## SCSS Architecture

### Modular Structure
The theme uses a **clean, modular SCSS architecture** with 10 semantic partials organized by component responsibility:

**Core Partials:**
- `_layout.scss` - Containers, grid system, page structure, spacing utilities
- `_header.scss` - Branding section, logo styling, header elements
- `_navigation.scss` - Navbar styling, menu components, mobile navigation
- `_content.scss` - Article styling, pagination, tag clouds, post content
- `_sidebar.scss` - Widget styling, sidebar components, search functionality
- `_carousel.scss` - Image carousel styling and responsive behavior
- `_comments.scss` - Comment system styling and form elements
- `_images.scss` - WordPress image classes, galleries, captions
- `_footer.scss` - Footer components and site generator
- `_utilities.scss` - Bootstrap overrides and utility classes

**Import Order in `style.scss`:**
```scss
// 1. Bootstrap functions and variables
@import "~bootstrap/scss/functions";

// 2. Theme variable overrides  
$orange: #fd7e14;
$primary: $orange;

// 3. Bootstrap core
@import "~bootstrap/scss/bootstrap";

// 4. Theme partials (organized by component)
@import "variables";
@import "typography";
@import "layout";
@import "header";
@import "navigation";
@import "content";
@import "sidebar";
@import "carousel";
@import "comments";
@import "images";
@import "footer";
@import "utilities";
@import "responsive";
```

### SCSS Best Practices

**CRITICAL: Maintain CSS specificity ordering**
- Order selectors from **least specific to most specific** within each partial
- General selectors (`.widget ul li`) must come before specific ones (`.widget_recent_comments ul li`)
- This prevents CSS linting errors and ensures predictable styling

**Code Quality Requirements:**
- **100% CSS lint compliance** is required (`npm run lint:css` must pass)
- **No duplicate selectors** across partials
- **No empty CSS blocks** (use comments instead of empty rules)
- **Proper newlines** at end of all SCSS files

**Organizational Guidelines:**
- Keep partials **focused and cohesive** (single responsibility)
- Use **semantic naming** that matches the component's purpose
- Add **clear section comments** within partials for complex styling
- Group related selectors together with explanatory comments

## Styling Guidelines
- **Prefer Bootstrap 5 utility classes** over custom CSS whenever possible
- Use classes like `px-4`, `py-3`, `mb-4`, `text-center`, `bg-light`, `border`, etc. instead of writing custom CSS
- Bootstrap provides extensive utility classes for spacing, colors, borders, typography, and layout
- Only add custom CSS when Bootstrap utilities are insufficient for the specific requirement
- Keep custom CSS minimal, well-documented, and scoped to specific components
- Always check Bootstrap documentation for existing utility classes before writing custom styles
- **When adding custom CSS**: Place it in the appropriate semantic partial, not in a monolithic file
- **Before committing**: Always run `npm run lint:css` to ensure code quality compliance

## Testing and Development Tools

### Site Testing Scripts (Not Committed)
Several development testing scripts are available but excluded from the repository via .gitignore:
- **spider-test.js**: Comprehensive URL testing with response validation
- **debug-check.js**: PHP error and warning detection across all pages  
- **performance-check.js**: Response time and asset loading analysis
- **Other dev tools**: build-modern.sh, dev-watch.sh, comparison tools

These scripts can be created as needed for development and testing but should not be committed to the repository.

### Debug Script Naming Guidelines
When creating temporary development/debugging scripts, use these naming patterns that are automatically ignored by .gitignore:

**Recommended naming patterns:**
- `debug-*.js` - For debugging specific issues (e.g., `debug-css.js`, `debug-layout.js`)
- `test-*.js` - For testing functionality (e.g., `test-mobile.js`, `test-performance.js`)
- `measure-*.js` - For measurement/analysis scripts (e.g., `measure-height.js`)
- `find-*.js` - For discovery/investigation scripts (e.g., `find-selectors.js`)
- `inspect-*.js` - For inspection tools (e.g., `inspect-styles.js`)
- `claude-*.js` - For Claude-specific development tools

**Examples of properly named debug scripts:**
```
debug-carousel-issue.js     ✅ Ignored by .gitignore
test-mobile-layout.js       ✅ Ignored by .gitignore  
measure-page-load.js        ✅ Ignored by .gitignore
find-unused-css.js          ✅ Ignored by .gitignore
inspect-dom-changes.js      ✅ Ignored by .gitignore
```

**Avoid these patterns:**
```
carousel-debug.js           ❌ Will be committed
mobile-test.js              ❌ Will be committed
analyze-layout.js           ❌ Will be committed
```

This ensures development tools remain local and don't clutter the repository or cause linting issues.

### Docker Development Environment
- **Setup**: `docker-compose up -d` to start WordPress + MySQL containers
- **Site URL**: http://localhost:8080
- **Testing**: Use the testing scripts above to validate theme functionality
- **Logs**: `docker logs engaged-philosophy-wp` to monitor WordPress container

## Code Quality and Static Analysis

### PHPStan Static Analysis
This project uses PHPStan for comprehensive PHP code quality analysis and maintains **Level 5 compliance** (maximum level).

**Setup:**
- **Install dependencies**: `composer install` (installs PHPStan with WordPress extensions)
- **Configuration**: `phpstan.neon` (configured for WordPress with Level 5 + strict checks)

**Usage:**
- **Run analysis**: `./vendor/bin/phpstan analyse`
- **With memory limit**: `./vendor/bin/phpstan analyse --memory-limit=2G`

**IMPORTANT: Always run PHPStan after making PHP changes**
- The theme maintains Level 5 PHPStan compliance with zero errors
- All PHP modifications should be validated with `./vendor/bin/phpstan analyse` before committing
- This ensures production-ready code quality, type safety, and PHP 8.0+ compatibility
- If PHPStan reports errors, they must be fixed to maintain the high code quality standard

### PHPStan Configuration Details
- **Analysis Level**: 5 (maximum standard level)
- **WordPress Integration**: Uses `szepeviktor/phpstan-wordpress` for WordPress-specific analysis
- **Strict Checks**: Enabled callable signature and uninitialized property checks
- **WordPress Functions**: Proper stubs loaded for WordPress core functions
- **Exclusions**: Ignores build artifacts, node_modules, and development scripts

### PHP_CodeSniffer (PHPCS) WordPress Coding Standards
This project uses PHPCS to enforce WordPress coding standards and maintain consistent code style.

**Setup:**
- **Install dependencies**: `composer install` (installs PHPCS with WordPress standards)
- **Configuration**: `phpcs.xml` (configured for WordPress with theme-specific customizations)

**Usage:**
- **Run analysis**: `./vendor/bin/phpcs` or `./vendor/bin/phpcs --report=summary`
- **Auto-fix issues**: `./vendor/bin/phpcbf` (fixes formatting violations automatically)
- **Specific files**: `./vendor/bin/phpcs path/to/file.php`

**IMPORTANT: Run PHPCS after making PHP changes**
- Maintains WordPress coding standards compliance
- Enforces consistent formatting, naming conventions, and best practices
- Auto-fixer (PHPCBF) can resolve most formatting issues automatically
- Manual review required for complex violations and security/performance issues

### PHPCS Configuration Details
- **WordPress Standards**: Uses WordPress core coding standards with theme-specific customizations
- **PHP Compatibility**: Checks for PHP 7.4+ compatibility using PHPCompatibilityWP
- **WordPress Version**: Minimum WordPress 5.0 support
- **Exclusions**: Ignores build artifacts, node_modules, vendor directories, and source files
- **Theme Customizations**: Allows array short syntax and theme-specific naming conventions

## CSS/SCSS Development Workflow

### Before Making Changes
1. **Understand the architecture**: Review the 10 SCSS partials above
2. **Identify the correct partial**: Place new styles in the appropriate component file
3. **Check Bootstrap utilities**: Use Bootstrap classes when possible instead of custom CSS

### While Making Changes
1. **Maintain specificity order**: General selectors before specific ones within each partial
2. **Add meaningful comments**: Document complex styling decisions
3. **Test incrementally**: Run `npm run build` to check for compilation errors

### Before Committing
1. **Run CSS linting**: `npm run lint:css` must pass with 0 errors
2. **Run JS linting**: `npm run lint:js` must pass with 0 errors  
3. **Test the build**: `npm run build` must complete successfully
4. **Visual verification**: Check layout integrity at different breakpoints

### Troubleshooting CSS Issues
**Common linting errors and fixes:**
- `no-descending-specificity`: Reorder selectors from least to most specific
- `no-duplicate-selectors`: Consolidate duplicate rules into single declarations
- `block-no-empty`: Remove empty CSS blocks or add meaningful content
- `no-missing-end-of-source-newline`: Add newline at end of SCSS files

**Architecture violations to avoid:**
- ❌ Adding styles to wrong partial (e.g., navigation styles in sidebar partial)
- ❌ Creating new monolithic SCSS files 
- ❌ Mixing component concerns in single partial
- ❌ Ignoring CSS linting errors

## Getting Started
1. **Install dependencies**: `npm install` and `composer install`
2. **Development**: `npm run start` or `./dev-watch.sh`
3. **Production build**: `npm run build` or `./build-modern.sh`
4. **Code linting**: `npm run lint:css` and `npm run lint:js` (both must pass)
5. **PHP static analysis**: `./vendor/bin/phpstan analyse` (Level 5 compliance required)
6. **PHP coding standards**: `./vendor/bin/phpcs` and `./vendor/bin/phpcbf` (WordPress standards compliance)
7. **Local testing**: `docker-compose up -d` and test at http://localhost:8080