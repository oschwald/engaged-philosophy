<?php
/** home.php
 *
 * Template Name: Home
 *
 */

get_header(); ?>

<script type="text/javascript">
jQuery(document).ready(function ($) {
  $('#projects_carousel').carousel({
    interval: 30000
  });
});
</script>

<section id="primary" class="span12">
  <?php tha_content_before(); ?>
  <div id="content" role="main">
    <div class="row">
      <div id="projects_carousel" class="carousel slide span9">
        <div class="carousel-inner">
          <?php

          query_posts(array ( 'post_type' => 'project', 'posts_per_page' => -1 ));

          if (have_posts()):
            $index = 0;
          while (have_posts()) {
            the_post();
            if (has_post_thumbnail() && get_field('highlight')) {
              ?>
              <div class="item <?php if ($index === 0) echo "active" ?>">
                <?php the_post_thumbnail(array(700, 460)); ?>
                <div class="carousel-caption">
                  <h4><?php the_title(); ?></h4>
                  <?php the_excerpt(); ?>
                </div>
              </div>
              <?php
              $index++;
            }
          }
          endif;
          wp_reset_query();
          wp_reset_postdata();

          ?>
        </div>
        <a class="left carousel-control" href="#projects_carousel" data-slide="prev">&lsaquo;</a>
        <a class="right carousel-control" href="#projects_carousel" data-slide="next">&rsaquo;</a>
      </div>
      <div class="span3">
        <div class="well lead lead-home">
          <?php
          the_post();
          the_content();
          ?>
        </div>
        <div class="well survey-box">
        <!--BEGIN QUALTRICS FEEDBACK LINK-->
<script type="text/javascript">
var Qualtrics_SV_01EXpZ4YggB9oYR = {
  url:document.URL,
  survey:"http://stkate.az1.qualtrics.com/SE/?SID=SV_01EXpZ4YggB9oYR",
  popup:function(width,height) {
    link=Qualtrics_SV_01EXpZ4YggB9oYR.survey+"&url="+Qualtrics_SV_01EXpZ4YggB9oYR.url;
    options = "menubar=no,width="+width+",height="+height+",toolbar=no,location=no,status=no,scrollbars=yes"
    var popupwindow = window.open(link,'Title',options);
    popupwindow.href+='&test';
  },
  showTip:function() {
    if(!document.getElementById('SV_01EXpZ4YggB9oYR'+'_tooltip')){
      var new_link = document.getElementById('SV_01EXpZ4YggB9oYR'+'_feedbacklink');
      var tip = document.createElement('div');
      tip.style.fontSize='8pt';
      tip.style.position='absolute';
      tip.style.backgroundColor = '#FFFFC7';
      tip.style.border='1px solid #FFDC81';
      tip.style.color='#777777';
      tip.style.fontFamily='Arial';
      tip.style.whiteSpace='nowrap';
      tip.style.textDecoration='none';
      tip.style.padding='2px';
      tip.id='SV_01EXpZ4YggB9oYR'+'_tooltip';
      tip.innerHTML='Let us know what you think about the Engaged Philosophy website';
      document.body.appendChild(tip);
      if (new_link.addEventListener){
          new_link.addEventListener('mousemove', Qualtrics_SV_01EXpZ4YggB9oYR.moveTip, false);
      } else if (new_link.attachEvent) {
        new_link.attachEvent('onmousemove', Qualtrics_SV_01EXpZ4YggB9oYR.moveTip);
      }
    }
  },
  moveTip:function(e) {
    if(document.getElementById('SV_01EXpZ4YggB9oYR'+'_tooltip')) {
      var tip=document.getElementById('SV_01EXpZ4YggB9oYR'+'_tooltip');
      var mouseX;var mouseY;
      if (e.pageX){mouseX=e.pageX;mouseY=e.pageY;} else{mouseX=e.clientX+document.documentElement.scrollLeft;mouseY=e.clientY+document.documentElement.scrollTop;}
      if (mouseY-25<0){tip.style.top=mouseY + 15 +'px';} else {tip.style.top=(mouseY-25)+'px';}
      if (mouseX+15+tip.offsetWidth>window.innerWidth){tip.style.left=(window.innerWidth-tip.offsetWidth)+'px';} else{tip.style.left=(mouseX+15)+'px';}
    }
  },
  removeTip:function() {
    var tip = document.getElementById('SV_01EXpZ4YggB9oYR'+'_tooltip');tip.parentNode.removeChild(tip);
    var new_link = document.getElementById('SV_01EXpZ4YggB9oYR'+'_feedbacklink');
    if (new_link.addEventListener){
       new_link.removeEventListener('mousemove', Qualtrics_SV_01EXpZ4YggB9oYR.moveTip, false);
    } else if (new_link.detachEvent){
       new_link.detachEvent('onmousemove', Qualtrics_SV_01EXpZ4YggB9oYR.moveTip);
    }
  }
}
var link=Qualtrics_SV_01EXpZ4YggB9oYR.survey+"&url="+Qualtrics_SV_01EXpZ4YggB9oYR.url;
document.write("<a id='SV_01EXpZ4YggB9oYR"+"_feedbacklink' href='#' onclick='Qualtrics_SV_01EXpZ4YggB9oYR.popup(900,600); return false;'>How are we doing?</a>");
var new_link = document.getElementById('SV_01EXpZ4YggB9oYR'+'_feedbacklink');
new_link.style.textDecoration='underline';
new_link.onmouseover=function(){Qualtrics_SV_01EXpZ4YggB9oYR.showTip();};
new_link.onmouseout=function(){Qualtrics_SV_01EXpZ4YggB9oYR.removeTip();};</script>
<noscript><a target="_blank" href="http://stkate.az1.qualtrics.com/SE/?SID=SV_01EXpZ4YggB9oYR">Feedback</a><br/>
</noscript>
<!--END QUALTRICS FEEDBACK LINK-->
        </div>
      </div>
    </div>
    <div class="row">
      <div class="span4">
        <h2><?php the_field('box-left-title'); ?></h2>
        <?php the_field('box-left'); ?>
      </div>
      <div class="span4">
        <h2><?php the_field('box-middle-title'); ?></h2>
        <?php the_field('box-middle'); ?>
      </div>
      <div class="span4">
        <h2><?php the_field('box-right-title'); ?></h2>
        <?php the_field('box-right'); ?>
      </div>
    </div>
<?php
    tha_content_bottom();
    ?>

  </div><!-- #content -->
  <?php tha_content_after(); ?>
</section><!-- #primary -->

<?php
get_footer();


/* End of file _full_width.php */
/* Location: ./wp-content/themes/the-bootstrap/_full_width.php */
