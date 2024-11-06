# About

This repo is a fork of [Philip I. Thomas' Queue Simulator repo][1] to enable
running the simulation over an arbitrary number of terminals, and to thereby
remove the need for any server-side rendering using Jekyll or similar.

You can try Philip's simulator online at [queue.philipithomas.com][2], or run
this fork by cloning the repo and opening `index.html` in a web browser.

# Philip's Original Explanation

This program was written for the Analysis and Simulation of Discrete Event
Systems class at [Washington University in St. Louis][3]. The script suggests
how many cashiers to have based on customer load and average service time.
The script analytically solves an [M/M/c][4] queue client-side using Javascript.


  [1]: https://github.com/philipithomas/Queue_Simulator
  [2]: http://queue.philipithomas.com
  [3]: https://washu.edu
  [4]: https://en.wikipedia.org/wiki/M/M/c_queue
