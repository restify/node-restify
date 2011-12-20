#!/usr/sbin/dtrace -s

#pragma D option quiet

BEGIN
{
    printf("\n\n***GetFoo Latency Breakdown****\n\n");
    printf("%-30s %12s\n", "HANDLER", "LATENCY");
}


exampleapp*:::getfoo-*-start
{
    tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = timestamp;
}

exampleapp*:::getfoo-*-done
/tracker[arg0, substr(probename, 0, rindex(probename, "-"))]/
{
    this->name = substr(probename, 0, rindex(probename, "-"));
    this->delta = ((timestamp - tracker[arg0, this->name]) / 100000);
    printf("%-30s %10dus\n", this->name, this->delta);
    tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = 0;
}

