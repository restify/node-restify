#!/usr/sbin/dtrace -s

#pragma D option quiet

exampleapp*:::getfoo-*-start
{
    tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = timestamp;
}

exampleapp*:::getfoo-*-done
/tracker[arg0, substr(probename, 0, rindex(probename, "-"))]/
{
    this->name = substr(probename, 0, rindex(probename, "-"));
    @[this->name] = quantize(((timestamp - tracker[arg0, this->name]) / 1000000));
    tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = 0;
}

