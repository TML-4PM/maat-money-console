import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* <!-- T4H-BRAND-INJECT v1 group=G6 */}
        <link rel="icon" type="image/png" sizes="32x32" href="https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png" />
        <link rel="icon" type="image/x-icon" href="https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.ico" />
        <link rel="apple-touch-icon" href="https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png" />
        <meta property="og:image" content="https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://lzfgigiyqpuuxslsygjt.supabase.co/storage/v1/object/public/images/t4h-icon.png" />
        {/* /T4H-BRAND-INJECT */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
