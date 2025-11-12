# Built-In Interpreters
I think Interpreters should be classes that wrap the processes we have currently implemented. It would have a parser and walk the tree of the parser in whichever order is needed for an expected output.

Having some built-in interpreters will allow users to easily create and manage their own interpreters without having to write complex code. This will also make it easier for users to share their interpreters with others.

Some built-in interpreters include:

- Interpreter to generate JavaScript code
- Interpreter to generate common framework bindings (HTML)

In these cases, we use the macro system of the OX parser to generate code and OX-defined structures into the target language/framework.

The interpreter for the combination above would have to:

 - Detect OX templates and generate JavaScript code that wraps the blocks written within.
 - Detect blocks and translate to HTML elements.
 - Use OX tags to define meta-data for the header of the HTML document.
 - Interpret variables as JavaScript expressions as well as their usages in OX templates.
 - Interpret `<on-data>` and `<on-error>` tags as `async function` expressions that handles the subject data retrieval and wrap the success and error cases in idiomatic JavaScript (Promises).
 - Consider custom properties in OX blocks and inject them possibly as `x-data` attributes.
 - Map known HTML attributes to their equivalent property names in OX using the `defineTag` methodology.
 - Allow users to define re-usable blocks encapsulating other blocks generating HTML code.
 - Discard blocks without tag usage or consider them errors as it wouldn't map to a valid HTML element.
 - Have tags for defining routes, error handling, authentication, databases, and perhaps more.

This is just one example of how an interpreter can be implemented. There are many other possibilities depending on the target language/framework and the specific requirements of the user.
