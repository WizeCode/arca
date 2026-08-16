// pdf.service.ts
import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

// --- Registra os 'helpers' lógicos para o Handlebars ---
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('or', (...args) => {
    args.pop();
    return args.some(Boolean);
});
// --- Fim dos helpers ---

@Injectable()
export class PdfService {
    async generatePdfFromTemplate(templateName: string, data: unknown): Promise<Buffer> {
        const templatePath = path.resolve(process.cwd(), 'src', 'pdf', 'templates', `${templateName}.hbs`);
        const htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

        const compiledTemplate = Handlebars.compile(htmlTemplate);
        const htmlContent = compiledTemplate(data);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        await page.setContent(htmlContent, {
            waitUntil: 'load',
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '40px',
                bottom: '40px',
                left: '40px',
                right: '40px',
            },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }
}
