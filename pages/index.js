// Página principal - redireciona para o HTML estático
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Quiz 99 - Challenge</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <div dangerouslySetInnerHTML={{
        __html: typeof window !== 'undefined' ? '' : require('fs').readFileSync('./public/index.html', 'utf8')
      }} />
    </>
  );
}

export async function getStaticProps() {
  return {
    props: {},
  };
}
