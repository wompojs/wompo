import { type WompComponent, type WompProps } from '../womp';
export declare const ssr: (Component: WompComponent, props: WompProps) => {
    html: string;
    css: {
        [key: string]: string;
    };
    props: {
        [key: string]: WompProps[];
    };
};
