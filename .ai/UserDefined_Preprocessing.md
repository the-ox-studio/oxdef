# User-Defined Pre-processing
During the pre-processing phase, users should be able to read into blocks as they are processed during the **second pass**.

User can walk the tree and reverse walk during this pass, which they can invoke via the callback function:

```javascript
oxparser.macros.onWalk = macroWalk;
```

Users can walk the tree just as they would after processing and the final data tree is available, the difference being that block properties can be resolved by the user before the final data tree is produced.

Template references are **not** exposed during this process. Since templates are available at this stage, it is important users do not get the templates.

The workflow is as follows:

 * First pass retrieves and identifies blocks, templates and other types of data.
 * Second pass evaluates templates.
 * During evaluation, every time a block is marked "semi-final" (evaluated and can be added to thr final state), the user-defined walk function is invoked and the walk exposes the block to the user.
 * Once evaluation for a whole block is complete, the block is considered "final" and added to the final tree.

Users should be able to manipulate property values irrespective of whether or not they are evaluated. It is important to note that evaluation of property values cannot be done until the user has done with the walk.

The reason is because the user may have use for property values of the children before proprty values of the current block should be evaluated. Take a user interface scenario in which a user grows the size of the block based on the children.

 * User function gets called.
 * User checks a parameter, like auto-size, a custom defined property, and iterates the children.
 * User therefore must evaluate the children properties themselves.

```javascript
function macroWalk(block, parent) {
  const isAutoSize = block.properties["auto-size"] === true;
  
  let totalWidth = 0;
  let totalHeight = 0;
  if (isAutoSize) {
    const nextBlock = oxparser.macros.nextBlock();
    
    while (nextBlock.parent === block) {
      oxparser.macro.invokeWalk(nextBlock, nextBlock.parent);
      const childWidth = nextBlock.properties["width"];
      const childHeight = nextBlock.properties["height"];
      if (childWidth !== undefined && childWidth instanceof Number) {
        totalWidth += childWidth;
      }
      
      if (childHeight !== undefined && childHeight instanceof Number) {
        totalHeight += childHeight;
      }
    }
    
    oxparser.macros.back(); // back to the last block
    block.properties["width"] = totalWidth;
    block.properties["height"] = totalHeight;
  }
}
```

This is, of course, one of many examples where the user can both:

 * Traverse the tree during the second pass
 * Manually invoke walks, which advances the pre-processor to the next block.

If the user manually invokes the pre-processor cursor, and for that matter, manually invoke evaluation, the pre-processor must do what it would normally do:

 * Mark the block as evaluated (whether automated or by user input programmatically);
 * And, commit the final block to the final output, including their evaluated children.

The user must know that invoking a walk will force the pre-processor to evaluate any templates that exist within the current block - that is the block the user has walked to.

This gives users an opportunity to read and write properties **before** the blocks contents are evaluated by the act of walking to the next block. The next block is decided based on the evaluated properties of the current block, plus any variables outside the current scope.

For users walking into blocks, properties will have already been evaluated. A user will never see the expression of a property, only the evaluated result.

## Final Notes
Since OX can also be generated to code, another part of the parser is also exposed.

Users can walk the tree before macros are called. They can do this by assigning the following callback function:

```javascript
oxparser.init.onParse = onParse;
```

The `onParse` simply exposes all blocks before any pre-processing takes place. Users can use this to generate a more detailed output, which includes references to templates in this scenario.

`onParse` doesn't take any arguments and is only invoked once. Users can walk the fully parsed tree, and, if they want to, they can call `oxparser.finish()` to complete parsing early and prevent further steps from being invoked.