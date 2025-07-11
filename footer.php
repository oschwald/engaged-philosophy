<?php
/** footer.php
 *
 * @author		Konstantin Obenland
 * @package		The Bootstrap
 * @since		1.0.0	- 05.02.2012
 */

                tha_footer_before(); ?>
                <footer id="colophon" class="col-12">
                    <?php tha_footer_top(); ?>
                    <div id="page-footer" class="footer-custom d-flex align-items-center justify-content-between px-3 py-3">
                        <?php wp_nav_menu( array(
                            'container'			=>	'nav',
                            'container_class'	=>	'subnav',
                            'theme_location'	=>	'footer-menu',
                            'menu_class'		=>	'credits nav nav-pills',
                            'depth'				=>	3,
                            'fallback_cb'		=>	'the_bootstrap_credits',
                            'walker'			=>	new The_Bootstrap_Nav_Walker,
                        ) );
                        ?>
                        <div class="d-flex align-items-center gap-2"<?php echo has_nav_menu('footer-menu') ? ' class="footer-nav-menu"' : ''; ?>>
                                <div class="fb-like" data-href="https://www.facebook.com/engagedphilosophy" data-width="200" data-layout="button_count" data-action="like" data-show-faces="false" data-share="false"></div>
                                <a href="mailto:info@engagedphilosophy.com">info@engagedphilosophy.com</a>
                        </div>
                    </div><!-- #page-footer -->
                    <?php tha_footer_bottom(); ?>
                </footer><!-- #colophon -->
                <?php tha_footer_after(); ?>
            </div><!-- #page -->
        </div><!-- .container -->
        <?php wp_footer(); ?>
    </body>
</html>
<?php


/* End of file footer.php */
/* Location: ./wp-content/themes/the-bootstrap/footer.php */
