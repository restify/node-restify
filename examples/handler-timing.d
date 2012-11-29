#!/usr/sbin/dtrace -s
#pragma D option quiet

restify*:::route-start
{
        track[arg2] = timestamp;
}


restify*:::handler-start
/track[arg3]/
{
        h[arg3, copyinstr(arg2)] = timestamp;
}


restify*:::handler-done
/track[arg3] && h[arg3, copyinstr(arg2)]/
{

        @[copyinstr(arg2)] = quantize((timestamp - h[arg3, copyinstr(arg2)]) / 1000000);
        h[arg3, copyinstr(arg2)] = 0;
}


restify*:::route-done
/track[arg2]/
{
        @[copyinstr(arg1)] = quantize((timestamp - track[arg2]) / 1000000);
        track[arg2] = 0;
}
