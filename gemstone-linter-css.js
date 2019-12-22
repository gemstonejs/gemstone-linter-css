/*
**  GemstoneJS -- Gemstone JavaScript Technology Stack
**  Copyright (c) 2016-2019 Gemstone Project <http://gemstonejs.com>
**  Licensed under Apache License 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  load external requirements  */
const path                    = require("path")
const fs                      = require("mz/fs")
const clone                   = require("clone")
const PostCSS                 = require("postcss")
const PostCSSSCSS             = require("postcss-scss")
const StyleLint               = require("stylelint")
const GemstoneStylelintConfig = require("gemstone-config-stylelint")

/*  exported API function  */
module.exports = async function (filenames, opts = {}, report = { sources: {}, findings: [] }) {
    let passed = true

    /*  interate over all source files  */
    if (typeof opts.progress === "function")
        opts.progress(0.0, "linting CSS: starting")
    for (let i = 0; i < filenames.length; i++) {
        /*  indicate progress  */
        if (typeof opts.progress === "function")
            opts.progress(i / filenames.length, `linting CSS: ${filenames[i]}`)

        /*  read source code  */
        const source = await fs.readFile(filenames[i], "utf8")

        /*  determine name of source  */
        const name = path.relative(process.cwd(), filenames[i])

        /*  determine StyleLint configuration  */
        const config = clone(GemstoneStylelintConfig)
        if (typeof opts.rules === "object")
            Object.assign(config.rules, opts.rules)

        /*  lint CSS via PostCSS/SCSS/StyleLint  */
        const lintResult = await PostCSS([
            StyleLint({ config: config })
        ]).process(source, {
            from:   name,
            to:     name,
            parser: PostCSSSCSS
        }).catch((err) => {
            /*  take CSS parsing errors  */
            if (typeof err === "object" && err.name === "CssSyntaxError") {
                /*  transform CssSyntaxError  */
                let [ ,, line, col, msg ] = err.message.match(/^(.+):(\d+):(\d+):\s*(.+)$/)
                line = parseInt(line)
                col  = parseInt(col)
                report.findings.push({
                    ctx:      "CSS",
                    filename: name,
                    line:     line,
                    column:   col,
                    message:  msg,
                    ruleProc: "postcss-scss",
                    ruleId:   "*"
                })
            }
            else {
                /*  Ops, any other unknown error?  */
                report.findings.push({
                    ctx:      "CSS",
                    filename: name,
                    line:     1,
                    column:   1,
                    message:  `UNKNOWN PARSING ERROR: ${err}`,
                    ruleProc: "postcss-scss",
                    ruleId:   "*"
                })
            }
            report.sources[name] = source
            passed = false
        })

        /*  take CSS styling errors  */
        if (typeof lintResult === "object" && lintResult.messages) {
            lintResult.messages.forEach((message) => {
                let msg = message.text
                let ruleId = "unknown"
                const m = msg.match(/^(.+)\s*\((.+)\)$/)
                if (m !== null) {
                    msg    = m[1]
                    ruleId = m[2]
                }
                report.findings.push({
                    ctx:      "CSS",
                    filename: name,
                    line:     message.line,
                    column:   message.column,
                    message:  msg,
                    ruleProc: "stylelint",
                    ruleId:   ruleId
                })
                report.sources[name] = source
                passed = false
            })
        }
    }
    if (typeof opts.progress === "function")
        opts.progress(1.0, "y")
    return passed
}

