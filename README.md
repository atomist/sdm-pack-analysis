# @atomist/sdm-pack-analysis

[![atomist sdm goals](https://badge.atomist.com/T29E48P34/atomist/sdm-pack-analysis/861fefe5-af44-4445-b1b7-7f364712e386)](https://app.atomist.com/workspace/T29E48P34)
[![npm version](https://img.shields.io/npm/v/@atomist/sdm-pack-analysis.svg)](https://www.npmjs.com/package/@atomist/sdm-pack-anaylsis)

This project defines two stages of project analysis, which can be used to
drive delivery decisions and to classify projects.

The two stages are:

- _Project Analysis_: First phase. Takes the project source code and
builds an analysis that may be persisted. The most important part of
a `ProjectAnalysis` is the `elements` property, whose value is an indexed type which values
of type `TechnologyElement`. Because a `ProjectAnalysis` is designed to be
serialized and persisted it contains only data, and no functions.
- _Interpretation_: Second phase. Requires a `ProjectAnalysis` but not source
code, so can be run on persisted analyses. An `Interpretation` is computed
when necessary and not serialized to JSON, so it can specify functions and
delivery goals.

## Getting started

See the [Developer Quick Start][atomist-quick] to jump straight to
creating an SDM.

[atomist-quick]: https://docs.atomist.com/quick-start/ (Atomist - Developer Quick Start)

## Contributing

Contributions to this project from community members are encouraged
and appreciated. Please review the [Contributing
Guidelines](CONTRIBUTING.md) for more information. Also see the
[Development](#development) section in this document.

## Code of conduct

This project is governed by the [Code of
Conduct](CODE_OF_CONDUCT.md). You are expected to act in accordance
with this code by participating. Please report any unacceptable
behavior to code-of-conduct@atomist.com.

## Documentation

Please see [docs.atomist.com][atomist-doc] for
[developer][atomist-doc-sdm] documentation.

[atomist-doc-sdm]: https://docs.atomist.com/developer/sdm/ (Atomist Documentation - SDM Developer)

## Connect

Follow [@atomist][atomist-twitter] and [The Composition][atomist-blog]
blog related to SDM.

[atomist-twitter]: https://twitter.com/atomist (Atomist on Twitter)
[atomist-blog]: https://the-composition.com/ (The Composition - The Official Atomist Blog)

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist-seeds/sdm-pack/issues

## Development

You will need to install [Node.js][node] to build and test this
project.

[node]: https://nodejs.org/ (Node.js)

### Build and test

Install dependencies.

```
$ npm install
```

Use the `build` package script to compile, test, lint, and build the
documentation.

```
$ npm run build
```

### Release

Releases are handled via the [Atomist SDM][atomist-sdm].  Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
