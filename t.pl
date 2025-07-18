use v5.32;

sub wtf { 
    my $x = 0;
    return ($x = 1) + ($x = 2)
}
say wtf()
