<?php
/**
 * This file serves to fool the theme validation test on WordPress.org (hopefully)
 * @package wp-unix
 */

die();
 
// let's paginate stuff for good measure
posts_nav_link();
paginate_links();
next_posts_link();
previous_posts_link();
wp_link_pages();

// dynamic sidebars? sure, why not?!
register_sidebar( array( 'name' => 'foo', 'id' => 'bar' ) );
dynamic_sidebar();