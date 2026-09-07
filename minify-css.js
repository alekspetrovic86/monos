const { transform } = require('@parcel/css');

module.exports = async function minifyCSS(data) {
  const input = data.code || data;
  
  try {
    const result = transform({
      filename: 'style.css',
      code: Buffer.from(input),
      minify: true,
      sourceMap: !!data.map,
    });

    return {
      code: result.code.toString(),
      map: result.map ? result.map.toString() : null,
    };
  } catch (error) {
    console.error('CSS minification error:', error);
    // Return original code if minification fails
    return {
      code: input,
      map: data.map || null,
    };
  }
};
