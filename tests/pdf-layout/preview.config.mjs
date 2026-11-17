import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'tests/pdf-layout',base:'./',publicDir:false,plugins:[react()],define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify('/list-geroya-5e')},build:{outDir:'../../public/classic-preview',emptyOutDir:true}});
