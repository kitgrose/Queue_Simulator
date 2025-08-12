# About

This repo is a fork of [Philip I. Thomas' Queue Simulator repo][1] to enable
running the simulation over an arbitrary number of terminals, and to thereby
remove the need for any server-side rendering using Jekyll or similar.

You can run [this fork][2], or [Philip's original simulator][3] online, or you
can run this fork by cloning the repo and opening `index.html` in a web browser.

You can also run a separate [animated simulation][6], which is not based on
Philip's work.

# Philip's Original Explanation

This program was written for the Analysis and Simulation of Discrete Event
Systems class at [Washington University in St. Louis][4]. The script suggests
how many cashiers to have based on customer load and average service time.
The script analytically solves an [M/M/c][5] queue client-side using Javascript.


  [1]: https://github.com/philipithomas/Queue_Simulator
  [2]: https://kitgrose.github.io/Queue_Simulator/
  [3]: http://queue.philipithomas.com
  [4]: https://washu.edu
  [5]: https://en.wikipedia.org/wiki/M/M/c_queue
  [6]: https://kitgrose.github.io/Queue_Simulator/animated.html
