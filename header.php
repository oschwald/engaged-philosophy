<?php
/** header.php
 *
 * Displays all of the <head> section and everything up till </header>
 *
 * @author        Konstantin Obenland
 * @package        The Bootstrap
 * @since        1.0 - 05.02.2012
 */

?>
<!DOCTYPE html>
<html class="no-js" <?php language_attributes(); ?>>
<head>
  <?php tha_head_top(); ?>
  <link rel="profile" href="http://gmpg.org/xfn/11" />
  <meta charset="<?php bloginfo( 'charset' ); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title><?php wp_title( '&laquo;', true, 'right' ); ?></title>

  <?php tha_head_bottom(); ?>
  <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
  <div id="fb-root"></div>
  <script>(function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s); js.id = id;
  js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.0";
  fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));</script>

<!-- Main content container with unified header -->
<div class="container">
  <!-- Header logo section -->
  <?php tha_header_before(); ?>
  <header id="branding" role="banner" class="text-center py-3">
    <?php tha_header_top();
    wp_nav_menu( array(
      'container'            =>    'nav',
      'container_class'    =>    'subnav d-flex',
      'theme_location'    =>    'header-menu',
      'menu_class'        =>    'nav nav-pills ms-auto',
      'depth'                =>    3,
      'fallback_cb'        =>    false,
      'walker'            =>    new The_Bootstrap_Nav_Walker,
      ) ); ?>

      <?php if ( get_header_image() ) : ?>
      <a id="header-image" href="<?php echo esc_url( home_url( '/' ) ); ?>" title="<?php echo esc_attr( get_bloginfo( 'name', 'display' ) ); ?>" rel="home">
        <img src="<?php header_image(); ?>" alt="" />
      </a>
    <?php endif; // if ( get_header_image() ) ?>

  </header><!-- #branding -->
  <?php tha_header_after(); ?>

  <!-- Navigation bar - full width of container -->
  <nav id="access" role="navigation">
    <h3 class="assistive-text"><?php _e( 'Main menu', 'the-bootstrap' ); ?></h3>
    <div class="skip-link"><a class="assistive-text" href="#content" title="<?php esc_attr_e( 'Skip to primary content', 'the-bootstrap' ); ?>"><?php _e( 'Skip to primary content', 'the-bootstrap' ); ?></a></div>
    <div class="skip-link"><a class="assistive-text" href="#secondary" title="<?php esc_attr_e( 'Skip to secondary content', 'the-bootstrap' ); ?>"><?php _e( 'Skip to secondary content', 'the-bootstrap' ); ?></a></div>
    <div <?php the_bootstrap_navbar_class(); ?>>
      <!-- Mobile toggle button -->
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      
      <?php if ( the_bootstrap_options()->navbar_site_name ) : ?>
      <span class="navbar-brand"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></span>
      <?php endif;?>
      
      <div class="collapse navbar-collapse" id="navbarNav">
        <?php wp_nav_menu( array(
          'theme_location'    =>    'primary',
          'menu_class'        =>    'navbar-nav ms-auto',
          'depth'                =>    3,
          'fallback_cb'        =>    'wp_page_menu',
          'walker'            =>    new The_Bootstrap_Nav_Walker,
          ) );
        if ( the_bootstrap_options()->navbar_searchform ) {
          the_bootstrap_navbar_searchform();
        } ?>
      </div>
    </div>
  </nav><!-- #access -->

  <div id="page" class="hfeed row">
    <?php if ( function_exists( 'yoast_breadcrumb' ) ) {
      yoast_breadcrumb( '<nav id="breadcrumb" class="breadcrumb">', '</nav>' );
    }
    tha_header_bottom(); ?>

<?php
/* End of file header.php */
/* Location: ./wp-content/themes/the-bootstrap/header.php */
?>
