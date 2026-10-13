import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { ReviewsService } from "./modules/documents/reviews.service";
import { Database } from "./database/database";
import { AuthGuard } from "./common/auth.guard";
import { ErrorsFilter } from "./common/errors.filter";
import { AuthService } from "./modules/auth/auth.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuditService } from "./modules/audit/audit.service";
import { SettingsService } from "./modules/settings/settings.service";
import { SettingsController } from "./modules/settings/settings.controller";
import {
  StorageService,
  ObjectStorage,
} from "./modules/storage/storage.service";
import { PdfService } from "./modules/pdf/pdf.service";
import { FilesService } from "./modules/documents/files.service";
import { ClientsService } from "./modules/clients/clients.service";
import { ClientsController } from "./modules/clients/clients.controller";
import { UsersService } from "./modules/users/users.service";
import { UsersController } from "./modules/users/users.controller";
import { TemplatesService } from "./modules/templates/templates.service";
import { TemplatesController } from "./modules/templates/templates.controller";
import { DocumentsRepository } from "./modules/documents/documents.repository";
import { DocumentsService } from "./modules/documents/documents.service";
import { DocumentsController } from "./modules/documents/documents.controller";
import { DashboardController } from "./modules/documents/dashboard.controller";
import { SigningService } from "./modules/signing/signing.service";
import { SigningController } from "./modules/signing/signing.controller";
import { JobsService } from "./modules/jobs/jobs.service";
import { JobsController } from "./modules/jobs/jobs.controller";
import { VerificationController } from "./modules/verification/verification.controller";
@Module({
  controllers: [
    AuthController,
    SettingsController,
    ClientsController,
    UsersController,
    TemplatesController,
    DocumentsController,
    DashboardController,
    SigningController,
    JobsController,
    VerificationController,
  ],
  providers: [
    ReviewsService,
    UsersService,
    Database,
    AuthService,
    AuditService,
    SettingsService,
    StorageService,
    { provide: ObjectStorage, useExisting: StorageService },
    PdfService,
    FilesService,
    ClientsService,
    TemplatesService,
    DocumentsRepository,
    DocumentsService,
    SigningService,
    JobsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorsFilter },
  ],
})
export class AppModule {}
